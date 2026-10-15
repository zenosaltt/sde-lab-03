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

  async rate(currency: string) {
    if (currency === 'EUR') return { date: null, rate: 1 };
    const url = new URL(`https://api.frankfurter.dev/v2/rate/EUR/${currency}`);
    const data = await json(url) as { date?: string; rate?: number };
    if (typeof data.rate !== 'number' || !Number.isFinite(data.rate)) throw new Error('Invalid rate response');
    return { date: data.date ?? null, rate: data.rate };
  }
}
