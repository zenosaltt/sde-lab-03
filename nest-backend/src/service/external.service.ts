import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

const TIMEOUT_MS = 3000;
const WEATHER_CACHE_TTL_SECONDS = 600;

type Weather = { temperature_2m?: number; weather_code?: number; time?: string };

async function json(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

@Injectable()
export class ExternalService implements OnModuleDestroy {
  private readonly redis;

  constructor(config: ConfigService) {
    this.redis = createClient({
      socket: {
        host: config.get<string>('REDIS_HOST', '127.0.0.1'),
        port: config.get<number>('REDIS_PORT', 6379),
      },
      disableOfflineQueue: true,
    });
    this.redis.on('error', () => {});
    this.redis.connect().catch(() => {});
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  async weather(latitude: number, longitude: number): Promise<Weather> {
    const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as Weather;
    } catch {}

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    const data = await json(url) as { current?: Weather };
    if (typeof data.current?.temperature_2m !== 'number') throw new Error('Invalid weather response');

    try {
      await this.redis.set(cacheKey, JSON.stringify(data.current), { EX: WEATHER_CACHE_TTL_SECONDS });
    } catch {
    }
    return data.current;
  }

  // ESEMPIO GUIDATO: ottenere il tasso EUR -> currency da Frankfurter.
  // Contratto: currency è già normalizzata da parseCurrency nel controller.
  // Il risultato è un semplice number (es. 1.08), non un oggetto { rate: 1.08 }.
  // In TypeScript anche i numeri con decimali hanno tipo number: Promise<number>.
  // Documentazione: https://frankfurter.dev/#rate
  //
  // Passi per sostituire il placeholder:
  // 1. Se currency è 'EUR', restituisci subito 1: non serve una chiamata HTTP.
  // 2. Costruisci un URL per https://api.frankfurter.dev/v2/rate/EUR/${currency}
  //    usando una template string e new URL(...).
  // 3. Attendi json(url), l'helper definito sopra: esegue GET, applica il timeout
  //    di 3 secondi, controlla lo stato HTTP e legge il corpo JSON.
  // 4. Descrivi il corpo ricevuto con il tipo { rate?: number }.
  //    Frankfurter restituisce un oggetto; a noi interessa solo il campo rate.
  // 5. Verifica che rate sia un number e che Number.isFinite(rate) sia true.
  //    Altrimenti lancia new Error('Invalid rate response').
  // 6. Restituisci solo data.rate. Lascia propagare gli errori: available(...)
  //    nel controller li trasforma in { status: 'unavailable' }.
  //
  // Verifica dopo l'implementazione: EUR -> 1 senza rete; USD -> un numero;
  // risposta senza rate o errore HTTP -> Promise rifiutata.
  // In travel-options, il numero sarà in exchange.data e servirà a convertire
  // i prezzi; in caso di errore i prezzi convertiti saranno null.
  async rate(currency: string): Promise<number> {
    throw new Error('TODO: implementare rate seguendo i passi guidati');
  }
}
