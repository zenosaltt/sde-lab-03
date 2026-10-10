import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { TravelController } from './travel.controller.js';
import { TravelService } from './travel.service.js';
import { ExternalService } from './external.service.js';
import { City } from './city.entity.js';
import { Hotel } from './hotel.entity.js';

const city = { id: 2, name: 'Parigi', latitude: 48.8566, longitude: 2.3522 } as City;
const hotel = { id: 1, name: 'Demo', pricePerNightEur: 90, city } as Hotel;

function controller(rate: () => Promise<unknown>, weather: () => Promise<unknown>) {
  const travel = {
    city: vi.fn().mockResolvedValue(city),
    hotelsIn: vi.fn().mockResolvedValue([hotel]),
    flightsTo: vi.fn().mockResolvedValue([]),
  } as unknown as TravelService;
  const external = { rate, weather } as unknown as ExternalService;
  return new TravelController(travel, external);
}

describe('travel options', () => {
  it('keeps local EUR prices when both upstreams fail', async () => {
    const api = controller(
      () => Promise.reject(new Error('rate timeout')),
      () => Promise.reject(new Error('weather timeout')),
    );
    const result = await api.options(2, 'USD');
    expect(result.weather.status).toBe('unavailable');
    expect(result.exchange.status).toBe('unavailable');
    expect(result.hotels[0].pricePerNightEur).toBe(90);
    expect(result.hotels[0].pricePerNight).toBeNull();
  });

  it('converts prices without replacing their EUR value', async () => {
    const api = controller(
      () => Promise.resolve({ date: '2026-10-09', rate: 1.2 }),
      () => Promise.resolve({ temperature_2m: 20 }),
    );
    const result = await api.options(2, 'USD');
    expect(result.exchange.status).toBe('ok');
    expect(result.hotels[0].pricePerNightEur).toBe(90);
    expect(result.hotels[0].pricePerNight).toBe(108);
  });
});
