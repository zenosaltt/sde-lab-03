import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TravelService } from '../service/travel.service.ts';
import { ExternalService } from '../service/external.service.ts';

const DEFAULT_CURRENCY = 'EUR';

type Available<T> = { status: 'ok'; data: T } | { status: 'unavailable' };

async function available<T>(promise: Promise<T>): Promise<Available<T>> {
  try {
    return { status: 'ok', data: await promise };
  } catch {
    return { status: 'unavailable' };
  }
}

function requireJsonObject(body: unknown): Record<string, unknown> {
  const isPlainObject = typeof body === 'object' && body !== null && !Array.isArray(body);
  if (!isPlainObject) {
    throw new BadRequestException('JSON object required');
  }
  return body as Record<string, unknown>;
}

function requirePositiveId(id: number): number {
  if (id < 1) {
    throw new BadRequestException('ID must be positive');
  }
  return id;
}

function parseCurrency(requested: unknown): string {
  if (requested === undefined) {
    return DEFAULT_CURRENCY;
  }
  const currency = typeof requested === 'string' ? requested.toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException('currency must be a three-letter code');
  }
  return currency;
}

function convertPrice(priceEur: number, rate: number | null): number | null {
  if (rate === null) {
    return null;
  }
  return Math.round(Number(priceEur) * rate * 100) / 100;
}

@Controller()
export class TravelController {
  constructor(
    private readonly travel: TravelService,
    private readonly external: ExternalService,
  ) {}


  @Get('cities')
  getCities() {
    return this.travel.allCities();
  }

  @Get('cities/:id')
  getCity(@Param('id', ParseIntPipe) id: number) {
    return this.travel.city(requirePositiveId(id));
  }

  @Post('cities')
  createCity(@Body() body: unknown) {
    return this.travel.createCity(requireJsonObject(body));
  }


  @Get('flights')
  getFlights() {
    return this.travel.allFlights();
  }

  @Get('flights/:id')
  getFlight(@Param('id', ParseIntPipe) id: number) {
    return this.travel.flight(requirePositiveId(id));
  }

  @Post('flights')
  createFlight(@Body() body: unknown) {
    return this.travel.createFlight(requireJsonObject(body));
  }


  @Get('hotels')
  getHotels() {
    return this.travel.allHotels();
  }

  @Get('hotels/:id')
  getHotel(@Param('id', ParseIntPipe) id: number) {
    return this.travel.hotel(requirePositiveId(id));
  }

  @Post('hotels')
  createHotel(@Body() body: unknown) {
    return this.travel.createHotel(requireJsonObject(body));
  }


  @Get('cities/:id/travel-options')
  async getTravelOptions(
    @Param('id', ParseIntPipe) id: number,
    @Query('currency') requestedCurrency?: string,
  ) {
    const city = await this.travel.city(requirePositiveId(id));
    const currency = parseCurrency(requestedCurrency);

    const [hotels, flights, weather, exchange] = await Promise.all([
      this.travel.hotelsIn(city.id),
      this.travel.flightsTo(city.id),
      available(this.external.weather(city.latitude, city.longitude)),
      available(this.external.rate(currency)),
    ]);

    const rate = exchange.status === 'ok' ? exchange.data.rate : null;

    return {
      city,
      currency,
      weather,
      exchange,
      hotels: hotels.map((hotel) => ({
        ...hotel,
        pricePerNight: convertPrice(hotel.pricePerNight, rate),
      })),
      inboundFlights: flights.map((flight) => ({
        ...flight,
        price: convertPrice(flight.priceEur, rate),
      })),
    };
  }
}
