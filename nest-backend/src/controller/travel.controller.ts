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

  // ---------------------------------------------------------------------------
  // LAB EXERCISES (remove solutions before the lab)
  // ---------------------------------------------------------------------------

  // EXERCISE 1 (easy): city weather
  //
  // Goal: GET /cities/:id/weather
  // Combine one internal call (the city) with one external call (the weather).
  //
  // Expected response:
  //   {
  //     "city":    { "id": 3, "name": "Parigi", "latitude": 48.8566, ... },
  //     "weather": { "status": "ok", "data": { "temperature_2m": 11.4, "weather_code": 3 } }
  //   }
  //
  // Hints:
  //   1. Add a method with @Get('cities/:id/weather') and take the id with
  //      @Param('id', ParseIntPipe), like getCity does.
  //   2. Internal call first: await this.travel.city(requirePositiveId(id)).
  //      It already throws 404 if the city does not exist.
  //   3. External call second: this.external.weather(city.latitude, city.longitude).
  //      It needs the coordinates from step 2, so it must run AFTER it
  //      (sequential composition).
  //   4. Wrap the external call in available(...) so that an Open-Meteo failure
  //      returns { status: 'unavailable' } instead of a 500.
  //   5. Return { city, weather }.
  //
  // Test: /cities/3/weather -> 200, /cities/999/weather -> 404,
  //       /cities/0/weather -> 400.
  //
  // SOLUTION:
  // @Get('cities/:id/weather')
  // async getCityWeather(@Param('id', ParseIntPipe) id: number) {
  //   const city = await this.travel.city(requirePositiveId(id));
  //   const weather = await available(this.external.weather(city.latitude, city.longitude));
  //   return { city, weather };
  // }


  // EXERCISE 2 (easy+): city overview
  //
  // Goal: GET /cities/:id/overview
  // Return the city, its weather (as in exercise 1) and its hotels.
  //
  // Expected response:
  //   {
  //     "city":    { "id": 3, "name": "Parigi", ... },
  //     "weather": { "status": "ok", "data": { ... } },
  //     "hotels":  [ { "id": 6, "name": "Demo Hotel Senna", "pricePerNight": 90 }, ... ]
  //   }
  //
  // Hints:
  //   1. Start from your exercise 1 method: same route pattern, same pipes.
  //   2. Get the city first with this.travel.city(...). You need its id and
  //      its coordinates for the next calls.
  //   3. The two remaining calls do not depend on each other, so run them in
  //      parallel with Promise.all([...]):
  //        - this.travel.hotelsIn(city.id)                                (internal)
  //        - available(this.external.weather(city.latitude, city.longitude)) (external)
  //   4. Return { city, weather, hotels }.
  //
  // Test: /cities/3/overview -> city + weather + 3 hotels,
  //       /cities/5/overview -> Madrid, a single hotel (every seeded city has at least one),
  //       /cities/999/overview -> 404.
  //
  // Bonus: add ?currency= and convert the hotel prices, like getTravelOptions does
  //        (parseCurrency, this.external.rate, convertPrice).
  //
  // SOLUTION:
  // @Get('cities/:id/overview')
  // async getCityOverview(@Param('id', ParseIntPipe) id: number) {
  //   const city = await this.travel.city(requirePositiveId(id));
  //   const [weather, hotels] = await Promise.all([
  //     available(this.external.weather(city.latitude, city.longitude)),
  //     this.travel.hotelsIn(city.id),
  //   ]);
  //   return { city, weather, hotels };
  // }
}
