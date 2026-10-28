import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../model/city.entity.ts';
import { Flight } from '../model/flight.entity.ts';
import { Hotel } from '../model/hotel.entity.ts';

// SERVICE
// Contains the logic that works on the local data (MySQL). It knows nothing
// about HTTP routes: the controller calls it and decides what to return.

// @Injectable() lets NestJS create this class and give it to whoever needs it
// (dependency injection): the controller just declares it in its constructor.
const FLIGHT_RELATIONS = { departureCity: true, arrivalCity: true } as const;

@Injectable()
export class TravelService {
  // NestJS injects one "repository" per entity. A repository is the object
  // used to read and write the rows of a table (cities, flights, hotels).
  constructor(
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Flight) private readonly flights: Repository<Flight>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
  ) {}


  // SELECT * FROM cities ORDER BY id. The order makes the output stable.
  allCities() { return this.cities.find({ order: { id: 'ASC' } }); }

  // "relations" tells TypeORM to also load the linked cities (JOIN), so each
  // flight contains the full departureCity and arrivalCity, not just their IDs.
  allFlights() { return this.flights.find({ relations: FLIGHT_RELATIONS, order: { id: 'ASC' } }); }

  // Same idea for hotels: each hotel includes its city.
  allHotels() { return this.hotels.find({ relations: { city: true }, order: { id: 'ASC' } }); }

  // Shared by city/flight/hotel: IDs start from 1 (otherwise 400), and a missing
  // row throws NotFoundException (404).
  private async load<T>(id: number, name: string, query: () => Promise<T | null>): Promise<T> {
    if (id < 1) throw new BadRequestException('ID must be positive');
    const row = await query();
    if (!row) throw new NotFoundException(`${name} not found`);
    return row;
  }

  city(id: number): Promise<City> {
    return this.load(id, 'City', () => this.cities.findOneBy({ id }));
  }

  // The flight is returned together with its departure and arrival city.
  flight(id: number): Promise<Flight> {
    return this.load(id, 'Flight', () => this.flights.findOne({ where: { id }, relations: FLIGHT_RELATIONS }));
  }

  hotel(id: number): Promise<Hotel> {
    return this.load(id, 'Hotel', () => this.hotels.findOne({ where: { id }, relations: { city: true } }));
  }

  // Used by the seed only: the data is typed and trusted, so there is no validation.
  createCity(data: { name: string; latitude: number; longitude: number; currency: string }) {
    return this.cities.save(this.cities.create(data));
  }

  createFlight(data: { departureCity: City; arrivalCity: City; departureTime: Date; arrivalTime: Date; airline: string; priceEur: number }) {
    return this.flights.save(this.flights.create(data));
  }

  createHotel(data: { city: City; name: string; pricePerNight: number }) {
    return this.hotels.save(this.hotels.create(data));
  }

  // The cheapest hotel of one city (lowest ID on a tie), or 404 if it has none.
  async cheapestHotelIn(cityId: number): Promise<Hotel> {
    const hotel = await this.hotels.findOne({
      where: { city: { id: cityId } }, relations: { city: true },
      order: { pricePerNight: 'ASC', id: 'ASC' },
    });
    if (!hotel) throw new NotFoundException('No hotel for this city');
    return hotel;
  }

  // The cheapest flight ARRIVING in the city (lowest ID on a tie), or 404 if there is none.
  async cheapestFlightTo(cityId: number): Promise<Flight> {
    const flight = await this.flights.findOne({
      where: { arrivalCity: { id: cityId } }, relations: FLIGHT_RELATIONS,
      order: { priceEur: 'ASC', id: 'ASC' },
    });
    if (!flight) throw new NotFoundException('No flight for this city');
    return flight;
  }

  async clearDB(): Promise<void> {
    await this.hotels.deleteAll();
    await this.flights.deleteAll();
    await this.cities.deleteAll();
  }
}
