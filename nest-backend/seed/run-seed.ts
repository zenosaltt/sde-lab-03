import type { TravelService } from '../src/service/travel.service.ts';
import { cities, getFlights, hotels } from './seed-data.ts';

// Il seed aggiunge solo i record mancanti; non aggiorna o cancella dati esistenti.
// Eseguire un solo seed alla volta, durante la preparazione del laboratorio.
export async function runSeed(travel: TravelService) {
  await travel.clearDB();
  const cityIds = new Map<string, number>();
  const added = { cities: 0, flights: 0, hotels: 0 };

  for (const city of cities) {
    let saved = await travel.createCity(city);
    added.cities++;
    cityIds.set(city.name, saved.id);
  }

  function cityId(name: string): number {
    const id = cityIds.get(name);
    if (id === undefined) throw new Error(`Seed city not found: ${name}`);
    return id;
  }

  for (const flight of getFlights()) {
    const departureCityId = cityId(flight.departureCity);
    const arrivalCityId = cityId(flight.arrivalCity);
    await travel.createFlight({
      departureCityId, arrivalCityId,
      departureTime: flight.departureTime, arrivalTime: flight.arrivalTime,
      airline: flight.airline, priceEur: flight.priceEur,
    });
    added.flights++;
  }

  for (const hotel of hotels) {
    const id = cityId(hotel.city);
    await travel.createHotel({
      cityId: id, name: hotel.name, pricePerNight: hotel.pricePerNight,
    });
    added.hotels++;
  }

  return { added, cityIds };
}
