import type { TravelService } from '../service/travel.service.ts';
import { cities, flights, hotels } from './seed-data.js';

type SeedService = Pick<TravelService,
  'allCities' | 'allFlights' | 'allHotels' | 'createCity' | 'createFlight' | 'createHotel'>;

// Il seed aggiunge solo i record mancanti; non aggiorna o cancella dati esistenti.
// Eseguire un solo seed alla volta, durante la preparazione del laboratorio.
export async function runSeed(travel: SeedService) {
  const existingCities = await travel.allCities();
  const cityIds = new Map<string, number>();
  const added = { cities: 0, flights: 0, hotels: 0 };

  for (const city of cities) {
    let saved = existingCities.find(item => item.name === city.name
      && item.latitude === city.latitude && item.longitude === city.longitude);
    if (!saved) {
      saved = await travel.createCity(city);
      existingCities.push(saved);
      added.cities++;
    }
    cityIds.set(city.name, saved.id);
  }

  function cityId(name: string): number {
    const id = cityIds.get(name);
    if (id === undefined) throw new Error(`Seed city not found: ${name}`);
    return id;
  }

  const existingFlights = await travel.allFlights();
  for (const flight of flights) {
    const departureCityId = cityId(flight.departureCity);
    const arrivalCityId = cityId(flight.arrivalCity);
    const exists = existingFlights.some(item => item.departureCity.id === departureCityId
      && item.arrivalCity.id === arrivalCityId && item.airline === flight.airline
      && item.departureTime.getTime() === Date.parse(flight.departureTime)
      && item.arrivalTime.getTime() === Date.parse(flight.arrivalTime));
    if (!exists) {
      existingFlights.push(await travel.createFlight({
        departureCityId, arrivalCityId,
        departureTime: flight.departureTime, arrivalTime: flight.arrivalTime,
        airline: flight.airline, priceEur: flight.priceEur,
      }));
      added.flights++;
    }
  }

  const existingHotels = await travel.allHotels();
  for (const hotel of hotels) {
    const id = cityId(hotel.city);
    if (!existingHotels.some(item => item.city.id === id && item.name === hotel.name)) {
      existingHotels.push(await travel.createHotel({
        cityId: id, name: hotel.name, pricePerNight: hotel.pricePerNight,
      }));
      added.hotels++;
    }
  }

  return { added, cityIds };
}
