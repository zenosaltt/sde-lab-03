import type { City } from '../src/model/city.entity.ts';
import type { TravelService } from '../src/service/travel.service.ts';
import { cities, getFlights, hotels } from './seed-data.ts';

// The seed deletes the existing data (clearDB) and creates it again from scratch.
// Run one seed at a time, while preparing the lab.
export async function runSeed(travel: TravelService) {
  await travel.clearDB();
  const savedCities = new Map<string, City>();
  const added = { cities: 0, flights: 0, hotels: 0 };

  for (const city of cities) {
    savedCities.set(city.name, await travel.createCity(city));
    added.cities++;
  }

  function savedCity(name: string): City {
    const city = savedCities.get(name);
    if (!city) throw new Error(`Seed city not found: ${name}`);
    return city;
  }

  for (const flight of getFlights()) {
    await travel.createFlight({
      departureCity: savedCity(flight.departureCity),
      arrivalCity: savedCity(flight.arrivalCity),
      departureTime: new Date(flight.departureTime),
      arrivalTime: new Date(flight.arrivalTime),
      airline: flight.airline, priceEur: flight.priceEur,
    });
    added.flights++;
  }

  for (const hotel of hotels) {
    await travel.createHotel({
      city: savedCity(hotel.city), name: hotel.name, pricePerNight: hotel.pricePerNight,
    });
    added.hotels++;
  }

  const cityIds = new Map([...savedCities].map(([name, city]) => [name, city.id]));
  return { added, cityIds };
}
