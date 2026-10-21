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
type Weather = { temperature_2m?: number; weather_code?: number; time?: string };

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

  // Returns the current weather for some coordinates, using Redis as cache.
  // Flow: 1) look in the cache  2) if missing, ask Open-Meteo  3) save in the cache.
  async weather(latitude: number, longitude: number): Promise<Weather> {
    // The key is built from the coordinates rounded to 2 decimals (about 1 km),
    // so nearby requests share the same cache entry. Example: "weather:48.86:2.35".
    const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

    // Step 1: cache lookup. The try/catch ignores Redis errors (e.g. Redis down):
    // in that case we simply continue and ask Open-Meteo.
    try {
      const cached = await this.redis.get(cacheKey);
      // Redis stores text, so we parse it back into an object. Cache hit: done.
      if (cached) return JSON.parse(cached) as Weather;
    } catch {}

    // Step 2: build the Open-Meteo URL. searchParams adds ?latitude=..&longitude=..
    // and takes care of the encoding.
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    // "current" asks only for the two values we need right now.
    url.searchParams.set('current', 'temperature_2m,weather_code');
    // "as { current?: Weather }" tells TypeScript the shape we expect.
    const data = await json(url) as { current?: Weather };
    // Validate the answer: if the temperature is missing the response is useless,
    // so we throw (the controller will report "unavailable").
    if (typeof data.current?.temperature_2m !== 'number') throw new Error('Invalid weather response');

    // Step 3: store the result in Redis as text, with an expiration (EX, seconds).
    // Again, if Redis fails we ignore it: the answer is still valid.
    try {
      await this.redis.set(cacheKey, JSON.stringify(data.current), { EX: WEATHER_CACHE_TTL_SECONDS });
    } catch {
    }
    return data.current;
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
