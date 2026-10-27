import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../model/city.entity.ts';
import { Flight } from '../model/flight.entity.ts';
import { Hotel } from '../model/hotel.entity.ts';

// The body of a POST request: a JSON object whose values we do not trust yet.
// "unknown" forces us to check every field before using it.
type Input = Record<string, unknown>;

// VALIDATION HELPERS
// Each helper checks one input value. If the value is wrong it throws
// BadRequestException, which NestJS turns into an HTTP 400 response.
// If the value is fine, it returns it with the right type.

// Checks that a value is a non-empty string of at most 100 characters
// (100 is the column length of the database).
function label(value: unknown, field: string): string {
  // Reject: not a string, only spaces/empty, or too long.
  if (typeof value !== 'string' || !value.trim() || value.length > 100) {
    // "field" is the name of the JSON property, so the error message tells
    // the client exactly what to fix.
    throw new BadRequestException(`${field} must be a non-empty string (max 100 characters)`);
  }
  // trim() removes spaces at the start and at the end: "  Roma " becomes "Roma".
  return value.trim();
}

// Checks that a value is a real number inside the range [min, max].
function number(value: unknown, field: string, min: number, max: number): number {
  // typeof "number" excludes strings like "10"; isFinite excludes NaN and Infinity.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${field} must be a number between ${min} and ${max}`);
  }
  return value;
}

// Checks that a value is a currency code with exactly three letters (EUR, usd, ...).
function currency(value: unknown): string {
  // The regular expression ^[A-Za-z]{3}$ means: exactly 3 letters, nothing else.
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value)) {
    throw new BadRequestException('currency must be a three-letter code');
  }
  // We always store codes in upper case, so "usd" and "USD" are the same.
  return value.toUpperCase();
}

// Checks that a value is an ISO 8601 UTC timestamp, e.g. "2026-11-20T09:00:00Z",
// and converts it into a JavaScript Date.
function date(value: unknown, field: string): Date {
  // The regular expression requires: YYYY-MM-DDTHH:MM:SS, optional decimals, and
  // the final "Z" (= UTC time zone). Anything else is rejected.
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)) {
    throw new BadRequestException(`${field} must be an ISO 8601 UTC timestamp`);
  }
  const parsed = new Date(value);
  // The format can be correct but the date impossible (e.g. month 13):
  // in that case Date produces an "invalid date" whose time is NaN.
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} is invalid`);
  return parsed;
}

// SERVICE
// Contains the logic that works on the local data (MySQL). It knows nothing
// about HTTP routes: the controller calls it and decides what to return.

// @Injectable() lets NestJS create this class and give it to whoever needs it
// (dependency injection): the controller just declares it in its constructor.
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
  allFlights() { return this.flights.find({ relations: { departureCity: true, arrivalCity: true }, order: { id: 'ASC' } }); }

  // Same idea for hotels: each hotel includes its city.
  allHotels() { return this.hotels.find({ relations: { city: true }, order: { id: 'ASC' } }); }

  // The three methods below share the same pattern: search by ID, and if the
  // row does not exist throw NotFoundException (HTTP 404).

  async city(id: number): Promise<City> {
    // findOneBy returns the row, or null if no city has this ID.
    const city = await this.cities.findOneBy({ id });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async flight(id: number): Promise<Flight> {
    // findOne is used (instead of findOneBy) because we also need "relations":
    // the flight is returned together with its departure and arrival city.
    const flight = await this.flights.findOne({ where: { id }, relations: { departureCity: true, arrivalCity: true } });
    if (!flight) throw new NotFoundException('Flight not found');
    return flight;
  }

  async hotel(id: number): Promise<Hotel> {
    const hotel = await this.hotels.findOne({ where: { id }, relations: { city: true } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  // The body is validated field by field BEFORE writing to the database.
  // If a helper throws, nothing is saved and the client receives a 400.

  createCity(body: Input) {
    // create() builds a City object in memory; it does not touch the database yet.
    const city = this.cities.create({
      name: label(body.name, 'name'),
      latitude: number(body.latitude, 'latitude', -90, 90),     // valid latitudes
      longitude: number(body.longitude, 'longitude', -180, 180), // valid longitudes
      currency: currency(body.currency),
    });
    // save() runs the INSERT and returns the new city, including its generated id.
    return this.cities.save(city);
  }

  async createFlight(body: Input) {
    // The IDs must be numbers >= 1 (checked here) and integers (checked below).
    const departureCityId = number(body.departureCityId, 'departureCityId', 1, Number.MAX_SAFE_INTEGER);
    const arrivalCityId = number(body.arrivalCityId, 'arrivalCityId', 1, Number.MAX_SAFE_INTEGER);
    // A flight needs integer IDs and two DIFFERENT cities.
    if (!Number.isInteger(departureCityId) || !Number.isInteger(arrivalCityId) || departureCityId === arrivalCityId) {
      throw new BadRequestException('Flight needs two different city IDs');
    }
    const departureTime = date(body.departureTime, 'departureTime');
    const arrivalTime = date(body.arrivalTime, 'arrivalTime');
    // Dates can be compared with <=: a flight cannot land before it takes off.
    if (arrivalTime <= departureTime) throw new BadRequestException('arrivalTime must be after departureTime');
    // The two cities must exist. this.city() throws 404 if one is missing.
    // The lookups are independent, so Promise.all runs them at the same time.
    const [departureCity, arrivalCity] = await Promise.all([this.city(departureCityId), this.city(arrivalCityId)]);
    // Build the Flight (create) and write it to the database (save).
    return this.flights.save(this.flights.create({
      departureCity, arrivalCity, departureTime, arrivalTime,
      airline: label(body.airline, 'airline'),
      priceEur: number(body.priceEur, 'priceEur', 0, 99999999.99), // price in EUR, never negative
    }));
  }

  async createHotel(body: Input) {
    const cityId = number(body.cityId, 'cityId', 1, Number.MAX_SAFE_INTEGER);
    // number() accepts 1.5, but an ID must be an integer.
    if (!Number.isInteger(cityId)) throw new BadRequestException('cityId must be an integer');
    // The hotel belongs to a city: if the city does not exist this throws 404.
    // This is the difference between a 400 (bad format) and a 404 (valid format, missing resource).
    const city = await this.city(cityId);
    return this.hotels.save(this.hotels.create({
      city,
      name: label(body.name, 'name'),
      pricePerNight: number(body.pricePerNight, 'pricePerNight', 0, 99999999.99), // per night, in the currency of the city of the hotel
    }));
  }

  // All the hotels of one city: WHERE hotel.cityId = :cityId.
  // An empty array (not an error) is returned when the city has no hotels.
  hotelsIn(cityId: number) {
    return this.hotels.find({ where: { city: { id: cityId } }, relations: { city: true } });
  }

  // All the flights that ARRIVE in the given city (inbound flights),
  // each with its departure and arrival city loaded.
  flightsTo(cityId: number) {
    return this.flights.find({ where: { arrivalCity: { id: cityId } }, relations: { departureCity: true, arrivalCity: true } });
  }

  async clearDB(): Promise<void> {
    await this.hotels.deleteAll();
    await this.flights.deleteAll();
    await this.cities.deleteAll();
  }
}
