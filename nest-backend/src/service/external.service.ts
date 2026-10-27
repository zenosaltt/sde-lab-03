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


  // Returns the weather for some coordinates. Without a date it uses the
  // current time; with a date it returns the weather of the UTC hour that
  // contains that instant (e.g. 17:10Z -> forecast of 17:00Z).
  // A date outside the coverage of Open-Meteo throws an error: the controller
  // turns it into "unavailable", it does not fall back to the current weather.
  async weather(latitude: number, longitude: number, date?: Date): Promise<Weather> {

    if (date == undefined) date = new Date();

    // Validate the date before using the cache or the network. It is a JavaScript
    // Date object, not a string: flights loaded by TypeORM already have an
    // arrivalTime of type Date.
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
      throw new Error('Invalid weather date');
    }
    const hour = Math.floor(date.getTime() / 3600000) * 3600;
    // The key contains the coordinates (rounded to 2 decimals) and the requested
    // hour, so different dates never share the same cached value.
    const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${hour}`;

    // 1. The cache is optional: a Redis error does not prevent the HTTP call.
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as Weather;
    } catch {}

    // 2. Reuse json(url): GET, 3-second timeout and HTTP status check.
    // The optional base URL (TRAVEL_WEATHER_BASE_URL) allows testing the
    // service against a simulated provider.
    const baseUrl = process.env.TRAVEL_WEATHER_BASE_URL ?? 'https://api.open-meteo.com';
    const url = new URL(`${baseUrl}/v1/forecast`);
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    let weather: Weather;

    // Ask for all the hours of the UTC day of the requested time. Unix time avoids
    // any interpretation in the local time zone of the server; all the arrays
    // use the same hourly index.
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
    

    // 3. Store the same object that is returned to the caller. It expires after
    // 10 minutes and a Redis write error does not change the HTTP answer.
    try {
      await this.redis.set(cacheKey, JSON.stringify(weather), { EX: WEATHER_CACHE_TTL_SECONDS });
    } catch {}
    return weather;
  }

  // GUIDED EXAMPLE 1: query the external REST service Frankfurter.
  // The goal is to implement rate('EUR', 'USD'), which returns the value of
  // 1 EUR in USD. The rate is later used as a multiplier to convert a price.
  async rateExample(from: string, to: string): Promise<number> {
    // 1. Start from GET /rate/EUR/USD of our own API: the controller has already
    //    converted the codes to upper case and checked the three letters.
    //    This does not guarantee that Frankfurter supports the currency.

    // 2. Build a URL object for the external resource:
    //    https://api.frankfurter.dev/v2/rate/{from}/{to}
    //    Replace the placeholders with the parameters. No API key is needed.
    //    Do not confuse the local route with the HTTP request to Frankfurter.

    // 3. Call the json(url) helper with await. Look at its definition: it
    //    performs a GET with fetch, stops waiting after 3 seconds, checks
    //    response.ok and parses the JSON body.
    //    async/await lets us wait for the network without blocking Node.js.

    // 4. Read the rate property of the answer. The helper returns unknown:
    //    describe the expected shape with { rate?: number }, remembering that
    //    a TypeScript assertion does not validate data received at runtime.
    //    Check that rate is a number and that Number.isFinite is true;
    //    otherwise throw an error, never return an invented rate.

    // 5. Return only the numeric rate, not the whole external answer.
    //    Let errors propagate: available(...) in the controller turns them
    //    into { status: 'unavailable' }, keeping HTTP 200.

    // 6. After the implementation, try GET /rate/EUR/USD: we expect
    //    { status: 'ok', data: <number> }, whose value changes over time.
    //    With /rate/EUR/US we expect 400 from the local validation;
    //    with /rate/EUR/ZZZ we expect 'unavailable' because of the external error.

    // TODO: implement steps 2-5 together and remove this placeholder.
    // Meanwhile the project still compiles and the endpoints that use the
    // exchange rate report it as unavailable.
    throw new Error('Not implemented');
  }

  // SOLUTION
  async rate(from: string, to: string): Promise<number> {
    // Set the URL with requested parameters.
    const url = new URL(`https://api.frankfurter.dev/v2/rate/${from}/${to}`);
  
    // Wait for GET and consequent JSON parsing
    const data = await json(url) as { rate?: number };
  
    // Sanity check
    if (typeof data.rate !== 'number' || !Number.isFinite(data.rate)) {
      throw new Error('Invalid rate response');
    }
  
    return data.rate;
  }
}
