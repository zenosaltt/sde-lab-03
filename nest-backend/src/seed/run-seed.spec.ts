import { describe, expect, it, vi } from 'vitest';
import type { City } from '../travel/city.entity.js';
import type { Flight } from '../travel/flight.entity.js';
import type { Hotel } from '../travel/hotel.entity.js';
import { cities } from './seed-data.js';
import { runSeed } from './run-seed.js';

function fixture() {
  let nextId = 100;
  const storedCities: City[] = [];
  const storedFlights: Flight[] = [];
  const storedHotels: Hotel[] = [];
  const travel = {
    allCities: async () => [...storedCities],
    allFlights: async () => [...storedFlights],
    allHotels: async () => [...storedHotels],
    createCity: vi.fn(async (body: Record<string, unknown>) => {
      const city = { id: nextId++, ...body } as City;
      storedCities.push(city);
      return city;
    }),
    createFlight: vi.fn(async (body: Record<string, unknown>) => {
      const flight = {
        id: nextId++,
        departureCity: storedCities.find(city => city.id === body.departureCityId)!,
        arrivalCity: storedCities.find(city => city.id === body.arrivalCityId)!,
        departureTime: new Date(body.departureTime as string),
        arrivalTime: new Date(body.arrivalTime as string),
        airline: body.airline as string,
        priceEur: body.priceEur as number,
      };
      storedFlights.push(flight);
      return flight;
    }),
    createHotel: vi.fn(async (body: Record<string, unknown>) => {
      const hotel = {
        id: nextId++, city: storedCities.find(city => city.id === body.cityId)!,
        name: body.name as string, pricePerNightEur: body.pricePerNightEur as number,
      };
      storedHotels.push(hotel);
      return hotel;
    }),
  };
  return { travel, storedCities, storedFlights, storedHotels };
}

describe('lab seed', () => {
  it('creates 6 cities, 11 valid flights and 13 hotels using generated IDs', async () => {
    const { travel, storedCities, storedFlights, storedHotels } = fixture();
    const result = await runSeed(travel);
    expect(result.added).toEqual({ cities: 6, flights: 11, hotels: 13 });
    expect(storedCities).toHaveLength(6);
    expect(storedFlights).toHaveLength(11);
    expect(storedHotels).toHaveLength(13);
    for (const flight of storedFlights) {
      expect(storedCities).toContain(flight.departureCity);
      expect(storedCities).toContain(flight.arrivalCity);
      expect(flight.departureCity.id).not.toBe(flight.arrivalCity.id);
      expect(flight.arrivalTime.getTime()).toBeGreaterThan(flight.departureTime.getTime());
    }
    for (const hotel of storedHotels) expect(storedCities).toContain(hotel.city);
    expect(storedHotels.filter(hotel => hotel.city.name === 'Madrid')).toEqual([]);
    expect(storedFlights.filter(flight => flight.arrivalCity.name === 'Berlino')).toEqual([]);
  });

  it('reuses existing cities and preserves student records and changed prices on rerun', async () => {
    const { travel, storedCities, storedFlights, storedHotels } = fixture();
    const rome = { id: 42, ...cities[0] };
    const studentHotel = { id: 43, city: rome, name: 'Hotel dello studente', pricePerNightEur: 60 };
    storedCities.push(rome);
    storedHotels.push(studentHotel);
    expect((await runSeed(travel)).added).toEqual({ cities: 5, flights: 11, hotels: 13 });
    storedFlights[0].priceEur = 42;
    storedHotels[1].pricePerNightEur = 35;
    const before = JSON.stringify({ storedCities, storedFlights, storedHotels });
    const repeated = await runSeed(travel);
    expect(repeated.added).toEqual({ cities: 0, flights: 0, hotels: 0 });
    expect(repeated.cityIds.get('Roma')).toBe(42);
    expect(JSON.stringify({ storedCities, storedFlights, storedHotels })).toBe(before);
  });

  it('completes missing records after an interrupted run', async () => {
    const { travel, storedCities, storedFlights, storedHotels } = fixture();
    travel.createHotel.mockRejectedValueOnce(new Error('Database temporarily unavailable'));
    await expect(runSeed(travel)).rejects.toThrow('Database temporarily unavailable');
    expect((await runSeed(travel)).added).toEqual({ cities: 0, flights: 0, hotels: 13 });
    expect(storedCities).toHaveLength(6);
    expect(storedFlights).toHaveLength(11);
    expect(storedHotels).toHaveLength(13);
  });
});
