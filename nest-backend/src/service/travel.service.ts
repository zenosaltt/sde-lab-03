import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from '../model/city.entity.ts';
import { Flight } from '../model/flight.entity.ts';
import { Hotel } from '../model/hotel.entity.ts';

type Input = Record<string, unknown>;

function label(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) {
    throw new BadRequestException(`${field} must be a non-empty string (max 100 characters)`);
  }
  return value.trim();
}

function number(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new BadRequestException(`${field} must be a number between ${min} and ${max}`);
  }
  return value;
}

function currency(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value)) {
    throw new BadRequestException('currency must be a three-letter code');
  }
  return value.toUpperCase();
}

function date(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value)) {
    throw new BadRequestException(`${field} must be an ISO 8601 UTC timestamp`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} is invalid`);
  return parsed;
}

@Injectable()
export class TravelService {
  constructor(
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Flight) private readonly flights: Repository<Flight>,
    @InjectRepository(Hotel) private readonly hotels: Repository<Hotel>,
  ) {}

  allCities() { return this.cities.find({ order: { id: 'ASC' } }); }
  allFlights() { return this.flights.find({ relations: { departureCity: true, arrivalCity: true }, order: { id: 'ASC' } }); }
  allHotels() { return this.hotels.find({ relations: { city: true }, order: { id: 'ASC' } }); }

  async city(id: number): Promise<City> {
    const city = await this.cities.findOneBy({ id });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async flight(id: number): Promise<Flight> {
    const flight = await this.flights.findOne({ where: { id }, relations: { departureCity: true, arrivalCity: true } });
    if (!flight) throw new NotFoundException('Flight not found');
    return flight;
  }

  async hotel(id: number): Promise<Hotel> {
    const hotel = await this.hotels.findOne({ where: { id }, relations: { city: true } });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  createCity(body: Input) {
    const city = this.cities.create({
      name: label(body.name, 'name'),
      latitude: number(body.latitude, 'latitude', -90, 90),
      longitude: number(body.longitude, 'longitude', -180, 180),
      currency: currency(body.currency),
    });
    return this.cities.save(city);
  }

  async createFlight(body: Input) {
    const departureCityId = number(body.departureCityId, 'departureCityId', 1, Number.MAX_SAFE_INTEGER);
    const arrivalCityId = number(body.arrivalCityId, 'arrivalCityId', 1, Number.MAX_SAFE_INTEGER);
    if (!Number.isInteger(departureCityId) || !Number.isInteger(arrivalCityId) || departureCityId === arrivalCityId) {
      throw new BadRequestException('Flight needs two different city IDs');
    }
    const departureTime = date(body.departureTime, 'departureTime');
    const arrivalTime = date(body.arrivalTime, 'arrivalTime');
    if (arrivalTime <= departureTime) throw new BadRequestException('arrivalTime must be after departureTime');
    const [departureCity, arrivalCity] = await Promise.all([this.city(departureCityId), this.city(arrivalCityId)]);
    return this.flights.save(this.flights.create({
      departureCity, arrivalCity, departureTime, arrivalTime,
      airline: label(body.airline, 'airline'),
      priceEur: number(body.priceEur, 'priceEur', 0, 99999999.99),
    }));
  }

  async createHotel(body: Input) {
    const cityId = number(body.cityId, 'cityId', 1, Number.MAX_SAFE_INTEGER);
    if (!Number.isInteger(cityId)) throw new BadRequestException('cityId must be an integer');
    const city = await this.city(cityId);
    return this.hotels.save(this.hotels.create({
      city,
      name: label(body.name, 'name'),
      pricePerNight: number(body.pricePerNight, 'pricePerNight', 0, 99999999.99),
    }));
  }

  hotelsIn(cityId: number) {
    return this.hotels.find({ where: { city: { id: cityId } }, relations: { city: true } });
  }

  flightsTo(cityId: number) {
    return this.flights.find({ where: { arrivalCity: { id: cityId } }, relations: { departureCity: true, arrivalCity: true } });
  }
}
