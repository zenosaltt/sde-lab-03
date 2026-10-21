import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

// Maximum time we wait for an external API before giving up (3 seconds).
// Without a timeout, a slow service would block our own response forever.
const TIMEOUT_MS = 3000;
// How long a cached weather value stays in Redis (600 s = 10 minutes).
// After that Redis deletes it and the next request asks Open-Meteo again.
const WEATHER_CACHE_TTL_SECONDS = 600;

// The part of the Open-Meteo answer we use. "?" means the field may be missing,
// so TypeScript forces us to check before relying on it.
type Weather = { temperature_2m?: number; weather_code?: number; time?: string; temperatureUnit?: string };

// Downloads JSON from a URL. Throws an error (never returns bad data) when:
// - the server does not answer within TIMEOUT_MS (AbortSignal.timeout aborts the request),
// - the server answers with an error status (404, 500, ...).
// The callers (see "available" in the controller) catch the error and turn it
// into { status: 'unavailable' }.
async function json(url: URL): Promise<unknown> {
  // fetch() performs the HTTP GET; "signal" cancels it after the timeout.
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  // response.ok is true only for status 200-299.
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  // Reads the body and parses it as JSON. The type is "unknown" because we
  // cannot trust what the external server sends: callers must check it.
  return response.json();
}

// Wraps the two external APIs: Open-Meteo (weather) and Frankfurter (exchange
// rates). Redis is used only as a cache for the weather.
// OnModuleDestroy means NestJS calls onModuleDestroy() when the app stops.
@Injectable()
export class ExternalService implements OnModuleDestroy {
  // The Redis client (its type is inferred from createClient below).
  private readonly redis;

  // ConfigService gives access to the values of the .env file.
  constructor(config: ConfigService) {
    this.redis = createClient({
      socket: {
        // Where Redis runs. The second argument is the default used when the
        // variable is not set in .env.
        host: config.get<string>('REDIS_HOST', '127.0.0.1'),
        port: config.get<number>('REDIS_PORT', 6379),
      },
      // If Redis is down, commands fail immediately instead of waiting in a
      // queue: the cache must never slow down or break the API.
      disableOfflineQueue: true,
    });
    // Without an "error" listener, a Redis connection error would crash the
    // whole app. We ignore it on purpose: the cache is optional.
    this.redis.on('error', () => {});
    // Connect in the background. If it fails we just work without cache.
    this.redis.connect().catch(() => {});
  }

  // Called when the application shuts down: closes the Redis connection cleanly.
  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  // Senza date restituisce il meteo corrente; con date quello dell'ora UTC
  // che contiene l'istante richiesto (es. 17:10Z -> previsione delle 17:00Z).
  // Una data fuori dalla copertura di Open-Meteo genera un errore: il controller
  // lo converte in unavailable, senza ripiegare sul meteo corrente.
  async weather(latitude: number, longitude: number, date?: Date): Promise<Weather> {
    // Validare la data prima della cache e della rete. Date è un oggetto JavaScript,
    // non una stringa: i voli caricati da TypeORM hanno già arrivalTime di tipo Date.
    if (date !== undefined && (!(date instanceof Date) || !Number.isFinite(date.getTime()))) {
      throw new Error('Invalid weather date');
    }
    const hour = date === undefined ? undefined : Math.floor(date.getTime() / 3600000) * 3600;
    // Conserviamo la chiave originale per il meteo corrente; per una previsione
    // aggiungiamo l'ora richiesta, così date diverse non condividono lo stesso dato.
    const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}` +
      (hour === undefined ? '' : `:${hour}`);

    // 1. La cache è facoltativa: un errore Redis non impedisce la chiamata HTTP.
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as Weather;
    } catch {}

    // 2. Riutilizziamo json(url): GET, timeout di 3 secondi e controllo HTTP.
    // Il base URL opzionale permette di verificare il servizio con provider simulati.
    const baseUrl = process.env.TRAVEL_WEATHER_BASE_URL ?? 'https://api.open-meteo.com';
    const url = new URL(`${baseUrl}/v1/forecast`);
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    let weather: Weather;

    if (hour === undefined) {
      // Compatibilità con le chiamate esistenti a weather(latitude, longitude).
      url.searchParams.set('current', 'temperature_2m,weather_code');
      const data = await json(url) as { current?: Weather } | null;
      if (typeof data?.current?.temperature_2m !== 'number' ||
          !Number.isFinite(data.current.temperature_2m)) {
        throw new Error('Invalid weather response');
      }
      weather = data.current;
    } else {
      // Chiediamo le ore della data UTC di arrivo. Unix time evita interpretazioni
      // nel fuso locale del server; tutti gli array usano lo stesso indice orario.
      const day = new Date(hour * 1000).toISOString().slice(0, 10);
      url.searchParams.set('hourly', 'temperature_2m,weather_code');
      url.searchParams.set('temperature_unit', 'celsius');
      url.searchParams.set('timezone', 'GMT');
      url.searchParams.set('timeformat', 'unixtime');
      url.searchParams.set('start_date', day);
      url.searchParams.set('end_date', day);
      const data = await json(url) as {
        hourly?: { time?: unknown; temperature_2m?: unknown; weather_code?: unknown };
      } | null;
      const hourly = data?.hourly;
      if (!Array.isArray(hourly?.time) || !Array.isArray(hourly?.temperature_2m) ||
          !Array.isArray(hourly?.weather_code)) {
        throw new Error('Invalid hourly weather response');
      }
      const index = hourly.time.indexOf(hour);
      const temperature = hourly.temperature_2m[index];
      const code = hourly.weather_code[index];
      if (index < 0 || typeof temperature !== 'number' || !Number.isFinite(temperature) ||
          typeof code !== 'number' || !Number.isInteger(code) || code < 0 || code > 99) {
        throw new Error('Requested weather unavailable');
      }
      weather = {
        time: new Date(hour * 1000).toISOString(),
        temperature_2m: temperature,
        temperatureUnit: '°C',
        weather_code: code,
      };
    }

    // 3. Memorizziamo lo stesso oggetto restituito al chiamante. La scadenza resta
    // di 10 minuti e un errore di scrittura Redis non altera la risposta HTTP.
    try {
      await this.redis.set(cacheKey, JSON.stringify(weather), { EX: WEATHER_CACHE_TTL_SECONDS });
    } catch {}
    return weather;
  }

  // ESEMPIO 1 — Query the external REST service Frankfurter.
  // The objective is to implement rate('EUR', 'USD'), which, for example,
  // returns the value of EUR in USD. This rate is later used as a multiplier
  // to get the total price in USD.
  async rate(from: string, to: string): Promise<number> {
    // 1. Partire da GET /rate/EUR/USD della nostra API: il controller ha già
    //    normalizzato i codici in maiuscolo e verificato le tre lettere.
    //    Questo controllo non garantisce che Frankfurter supporti la valuta.

    // 2. Costruire un oggetto URL per la risorsa esterna:
    //    https://api.frankfurter.dev/v2/rate/{from}/{to}
    //    Sostituire i segnaposto con i parametri. Non serve una chiave API.
    //    Distinguere la rotta locale dalla richiesta HTTP verso Frankfurter.

    // 3. Chiamare l'helper json(url) con await. Risalire alla sua definizione:
    //    esegue una GET con fetch, interrompe l'attesa dopo 3 secondi,
    //    controlla response.ok e deserializza il corpo JSON.
    //    async/await permette di attendere la rete senza bloccare Node.js.

    // 4. Leggere la proprietà rate dalla risposta. L'helper restituisce unknown:
    //    descrivere la forma attesa con { rate?: number }, ricordando che
    //    un'asserzione TypeScript non valida i dati ricevuti a runtime.
    //    Verificare che rate sia un number e che Number.isFinite sia true;
    //    altrimenti lanciare un errore, senza restituire un tasso inventato.

    // 5. Restituire solo il tasso numerico, non l'intera risposta esterna.
    //    Lasciare propagare gli errori: available(...) nel controller li
    //    trasforma in { status: 'unavailable' }, mantenendo HTTP 200.

    // 6. Dopo l'implementazione, provare GET /rate/EUR/USD: ci aspettiamo
    //    { status: 'ok', data: <numero> }, il cui valore varia nel tempo.
    //    Con /rate/EUR/US ci aspettiamo 400 dalla validazione locale;
    //    con /rate/EUR/ZZZ ci aspettiamo 'unavailable' per l'errore esterno.

    // TODO: implementare insieme i passi 2–5 e rimuovere questo placeholder.
    // Nel frattempo il progetto resta compilabile e il controller segnala
    // il cambio come indisponibile, anche nella risposta travel-options.
    throw new Error('Not implemented');
  }

  // async rate(from: string, to: string): Promise<number> {
  //   // Set the URL with requested parameters.
  //   const url = new URL(`https://api.frankfurter.dev/v2/rate/${from}/${to}`);
  //
  //   // Wait for GET and consequent JSON parsing
  //   const data = await json(url) as { rate?: number };
  //
  //   // Sanity check
  //   if (typeof data.rate !== 'number' || !Number.isFinite(data.rate)) {
  //     throw new Error('Invalid rate response');
  //   }
  //
  //   return data.rate;
  // }
}
