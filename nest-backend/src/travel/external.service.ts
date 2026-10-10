import { Injectable } from '@nestjs/common';

const TIMEOUT_MS = 3000;

async function json(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

@Injectable()
export class ExternalService {
  async weather(latitude: number, longitude: number) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    const data = await json(url) as { current?: { temperature_2m?: number; weather_code?: number; time?: string } };
    if (typeof data.current?.temperature_2m !== 'number') throw new Error('Invalid weather response');
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
