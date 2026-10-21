import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { TravelService } from "../service/travel.service.ts";
import { ExternalService } from "../service/external.service.ts";

// Currency used when the client does not send ?currency=
const DEFAULT_CURRENCY = "EUR";

// Result of a call that may fail: either { status: 'ok', data: ... } or
// { status: 'unavailable' }. The "|" means "one or the other"; <T> is the type
// of the data (e.g. the weather object or the exchange rate number).
type Available<T> = { status: "ok"; data: T } | { status: "unavailable" };

// Waits for a promise (e.g. an external API call) and NEVER throws.
// - success -> { status: 'ok', data: <result> }
// - failure (timeout, HTTP error, invalid response) -> { status: 'unavailable' }
// This is what lets the endpoints answer 200 even if Open-Meteo or Frankfurter is down.
async function available<T>(promise: Promise<T>): Promise<Available<T>> {
  try {
    // "await" pauses here until the promise finishes; if it fails it jumps to catch.
    return { status: "ok", data: await promise };
  } catch {
    // We ignore the error details: the client only needs to know it is unavailable.
    return { status: "unavailable" };
  }
}

// Checks that the body of a POST is a JSON object like {"a": 1}.
// typeof null is "object" in JavaScript and arrays are objects too, so both
// are excluded explicitly. Otherwise -> 400.
function requireJsonObject(body: unknown): Record<string, unknown> {
  const isPlainObject =
    typeof body === "object" && body !== null && !Array.isArray(body);
  if (!isPlainObject) {
    throw new BadRequestException("JSON object required");
  }
  return body as Record<string, unknown>;
}

// IDs in the database start from 1. ParseIntPipe already guarantees that the
// value is an integer; this function rejects 0 and negative numbers with 400.
function requirePositiveId(id: number): number {
  if (id < 1) {
    throw new BadRequestException("ID must be positive");
  }
  return id;
}

// Reads the currency from the query string (?currency=usd).
// - missing -> default currency (EUR)
// - present -> converted to upper case and checked: exactly three letters, else 400
function parseCurrency(requested: unknown): string {
  if (requested === undefined) {
    return DEFAULT_CURRENCY;
  }
  // If it is not a string (e.g. ?currency=a&currency=b gives an array) we use ''
  // so that the check below fails and the request is rejected.
  const currency = typeof requested === "string" ? requested.toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException("currency must be a three-letter code");
  }
  return currency;
}

// Converts a price in EUR using the exchange rate.
// - rate === null means the exchange service was unavailable: we return null
//   (the client sees that the converted price is missing; the EUR price remains).
// - otherwise price * rate, rounded to 2 decimals (multiply by 100, round, divide by 100).
function convertPrice(priceEur: number, rate: number | null): number | null {
  if (rate === null) {
    return null;
  }
  // Number(...) makes sure we are multiplying numbers, not strings.
  return Math.round(Number(priceEur) * rate * 100) / 100;
}

// @Controller() marks the class as a set of HTTP routes. No prefix is given,
// so each route below uses its full path (e.g. /cities).
// The controller only handles HTTP: it reads parameters, calls the services
// and builds the response. Database logic is in TravelService, external APIs
// are in ExternalService.
@Controller()
export class TravelController {
  // NestJS creates the two services and passes them here (dependency injection).
  // "private readonly" also creates the fields this.travel and this.external.
  constructor(
    private readonly travel: TravelService,
    private readonly external: ExternalService,
  ) {}

  // Cities
  // GET /cities -> list of all cities.
  @Get("cities")
  getCities() {
    return this.travel.allCities();
  }

  // GET /cities/3 -> one city. ":id" is a path parameter.
  // ParseIntPipe converts "3" into the number 3 (and answers 400 for "abc").
  // requirePositiveId rejects 0 or negatives (400); the service answers 404 if the city does not exist.
  @Get("cities/:id")
  getCity(@Param("id", ParseIntPipe) id: number) {
    return this.travel.city(requirePositiveId(id));
  }

  // POST /cities -> creates a city from the JSON body. The service validates the fields.
  // @Body() gives us the JSON sent by the client; we first check it is an object.
  @Post("cities")
  createCity(@Body() body: unknown) {
    return this.travel.createCity(requireJsonObject(body));
  }

  // Flights

  // GET /flights -> all flights, with departure and arrival city.
  @Get("flights")
  getFlights() {
    return this.travel.allFlights();
  }

  // GET /flights/:id -> one flight (400 for an invalid ID, 404 if it does not exist).
  @Get("flights/:id")
  getFlight(@Param("id", ParseIntPipe) id: number) {
    return this.travel.flight(requirePositiveId(id));
  }

  // POST /flights -> creates a flight (the service checks cities, dates and price).
  @Post("flights")
  createFlight(@Body() body: unknown) {
    return this.travel.createFlight(requireJsonObject(body));
  }

  // Hotels

  // GET /hotels -> all hotels, each with its city.
  @Get("hotels")
  getHotels() {
    return this.travel.allHotels();
  }

  // GET /hotels/:id -> one hotel (400 invalid ID, 404 not found).
  @Get("hotels/:id")
  getHotel(@Param("id", ParseIntPipe) id: number) {
    return this.travel.hotel(requirePositiveId(id));
  }

  // POST /hotels -> creates a hotel in an existing city.
  @Post("hotels")
  createHotel(@Body() body: unknown) {
    return this.travel.createHotel(requireJsonObject(body));
  }

  // External exchange rate

  // GET /rate/EUR/USD -> exchange rate between two currencies, taken directly
  // from Frankfurter. No database is involved.
  @Get("rate/:from/:to")
  async getRate(@Param("from") from: string, @Param("to") to: string) {
    // Validate both codes (three letters, upper case); invalid -> 400.
    from = parseCurrency(from);
    to = parseCurrency(to);
    // available(...) turns an external failure into { status: 'unavailable' }
    // instead of an error, so the answer is still 200.
    return await available(this.external.rate(from, to));
  }

  // Aggregated endpoint

  // GET /cities/3/travel-options?currency=USD
  // Combines local data (city, hotels, flights from MySQL) with external data
  // (weather from Open-Meteo, exchange rate from Frankfurter) in one response.
  @Get("cities/:id/travel-options")
  async getTravelOptions(
    @Param("id", ParseIntPipe) id: number,
    // "?" = optional: it is undefined when the client sends no ?currency=
    @Query("currency") requestedCurrency?: string,
  ) {
    // 1) Local data that everything else depends on: the city (404 if missing).
    //    We need its coordinates (for the weather) and its id (for hotels/flights).
    const city = await this.travel.city(requirePositiveId(id));
    // 2) Validate the currency BEFORE calling anything external (400 if invalid).
    const currency = parseCurrency(requestedCurrency);

    // 3) Four independent calls started together with Promise.all, so the total
    //    time is that of the slowest one, not the sum of the four.
    //    - hotels and flights come from MySQL; if they fail, the whole request fails.
    //    - weather and exchange are wrapped in available(): if they fail we still
    //      answer, just marking that section as unavailable.
    //    The result array is unpacked in the same order as the calls.
    const [hotels, flights, weather, exchange] = await Promise.all([
      this.travel.hotelsIn(city.id),
      this.travel.flightsTo(city.id),
      available(this.external.weather(city.latitude, city.longitude)),
      available(this.external.rate("EUR", currency)),
    ]);

    // The rate is a plain number when the call worked, null otherwise.
    // convertPrice() handles null by returning null prices.
    const rate = exchange.status === "ok" ? exchange.data : null;

    return {
      city,
      currency,
      weather, // { status: 'ok', data: {...} } or { status: 'unavailable' }
      exchange, // same shape: the rate EUR -> requested currency
      // map() builds a new array. "...hotel" copies all the hotel fields
      // (including the original price in EUR) and then pricePerNight is
      // overwritten with the converted value.
      hotels: hotels.map((hotel) => ({
        ...hotel,
        pricePerNight: convertPrice(hotel.pricePerNight, rate),
      })),
      // Flights keep priceEur (original) and get a new field "price" (converted).
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

  // EXERCISE 3 (easy): flight with arrival weather
  //
  // Goal: GET /flights/:id/weather
  // Same pattern as exercise 1, but starting from a flight.
  //
  // Expected response:
  //   {
  //     "flight":  { "id": 1, "airline": "Demo Air", "arrivalCity": { "name": "Parigi", ... }, ... },
  //     "weather": { "status": "ok", "data": { "temperature_2m": 11.4, "weather_code": 3 } }
  //   }
  //
  // Hints:
  //   1. @Get('flights/:id/weather'), id with ParseIntPipe, like getFlight.
  //   2. this.travel.flight(requirePositiveId(id)) throws 404 if missing and
  //      already loads flight.arrivalCity.
  //   3. Weather of the ARRIVAL city, wrapped in available(...).
  //   4. Return { flight, weather }.
  //
  // Test: /flights/1/weather -> 200, /flights/999/weather -> 404, /flights/0/weather -> 400.
  //
  // SOLUTION:
  // @Get('flights/:id/weather')
  // async getFlightWeather(@Param('id', ParseIntPipe) id: number) {
  //   const flight = await this.travel.flight(requirePositiveId(id));
  //   const weather = await available(
  //     this.external.weather(flight.arrivalCity.latitude, flight.arrivalCity.longitude),
  //   );
  //   return { flight, weather };
  // }

  // EXERCISE 4 (easy+): cheapest hotel
  //
  // Goal: GET /cities/:id/hotels/cheapest
  // Return the city and its cheapest hotel. No external call.
  //
  // Expected response:
  //   { "city": { "id": 3, "name": "Parigi", ... },
  //     "hotel": { "id": 6, "name": "Demo Hotel Senna", "pricePerNight": 90 } }
  //
  // Hints:
  //   1. Get the city (404 if missing), then this.travel.hotelsIn(city.id).
  //   2. If the list is empty throw new NotFoundException('No hotels in this city')
  //      (import NotFoundException from @nestjs/common).
  //   3. Find the minimum pricePerNight with reduce.
  //
  // Test: /cities/3/hotels/cheapest -> Senna (90), /cities/999/hotels/cheapest -> 404,
  //       a city created with POST /cities and no hotels -> 404.
  //
  // SOLUTION:
  // @Get('cities/:id/hotels/cheapest')
  // async getCheapestHotel(@Param('id', ParseIntPipe) id: number) {
  //   const city = await this.travel.city(requirePositiveId(id));
  //   const hotels = await this.travel.hotelsIn(city.id);
  //   if (hotels.length === 0) {
  //     throw new NotFoundException('No hotels in this city');
  //   }
  //   const hotel = hotels.reduce((best, h) => (h.pricePerNight < best.pricePerNight ? h : best));
  //   return { city, hotel };
  // }
}
