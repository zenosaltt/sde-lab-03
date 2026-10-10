import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TravelService } from './travel.service.js';
import { ExternalService } from './external.service.js';

type Available<T> = { status: 'ok'; data: T } | { status: 'unavailable' };

async function available<T>(promise: Promise<T>): Promise<Available<T>> {
  try {
    return { status: 'ok', data: await promise };
  } catch {
    return { status: 'unavailable' };
  }
}

function input(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('JSON object required');
  }
  return body as Record<string, unknown>;
}

function id(value: number): number {
  if (value < 1) throw new BadRequestException('ID must be positive');
  return value;
}

@Controller()
export class TravelController {
  constructor(private readonly travel: TravelService, private readonly external: ExternalService) {}

  @Get('cities') cities() { return this.travel.allCities(); }
  @Get('cities/:id') city(@Param('id', ParseIntPipe) value: number) { return this.travel.city(id(value)); }
  @Post('cities') createCity(@Body() body: unknown) { return this.travel.createCity(input(body)); }

  @Get('flights') flights() { return this.travel.allFlights(); }
  @Get('flights/:id') flight(@Param('id', ParseIntPipe) value: number) { return this.travel.flight(id(value)); }
  @Post('flights') createFlight(@Body() body: unknown) { return this.travel.createFlight(input(body)); }

  @Get('hotels') hotels() { return this.travel.allHotels(); }
  @Get('hotels/:id') hotel(@Param('id', ParseIntPipe) value: number) { return this.travel.hotel(id(value)); }
  @Post('hotels') createHotel(@Body() body: unknown) { return this.travel.createHotel(input(body)); }

  @Get('cities/:id/travel-options')
  async options(@Param('id', ParseIntPipe) value: number, @Query('currency') requested?: string) {
    const city = await this.travel.city(id(value));
    const currency = requested === undefined ? 'EUR' : typeof requested === 'string' ? requested.toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('currency must be a three-letter code');

    const [hotels, flights, weather, exchange] = await Promise.all([
      this.travel.hotelsIn(city.id),
      this.travel.flightsTo(city.id),
      available(this.external.weather(city.latitude, city.longitude)),
      available(this.external.rate(currency)),
    ]);
    const rate = exchange.status === 'ok' ? exchange.data.rate : null;
    const converted = (price: number) => rate === null ? null : Math.round(Number(price) * rate * 100) / 100;
    return {
      city, currency, weather, exchange,
      hotels: hotels.map(hotel => ({ ...hotel, pricePerNight: converted(hotel.pricePerNightEur) })),
      inboundFlights: flights.map(flight => ({ ...flight, price: converted(flight.priceEur) })),
    };
  }
}
