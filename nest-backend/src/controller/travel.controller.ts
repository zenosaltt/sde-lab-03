import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { TravelService } from "../service/travel.service.ts";
import { ExternalService } from "../service/external.service.ts";

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

// IDs in the database start from 1. ParseIntPipe already guarantees that the
// value is an integer; this function rejects 0 and negative numbers with 400.
function requirePositiveId(id: number): number {
  if (id < 1) {
    throw new BadRequestException("ID must be positive");
  }
  return id;
}

// Reads a currency code (e.g. from ?currency=usd).
// It is converted to upper case and checked: exactly three letters, else 400.
// A missing currency is rejected too, so the endpoints that need one require it.
function parseCurrency(requested: unknown): string {
  // If it is not a string (e.g. ?currency=a&currency=b gives an array) we use ''
  // so that the check below fails and the request is rejected.
  const currency = typeof requested === "string" ? requested.toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException("currency must be a three-letter code");
  }
  return currency;
}

// Converts a price using the exchange rate (from the currency of the price to
// the requested one).
// - rate === null means the exchange service was unavailable: we return null
//   (the client sees that the converted price is missing; the original price remains).
// - otherwise price * rate, rounded to 2 decimals (multiply by 100, round, divide by 100).
function convertPrice(price: number, rate: number | null): number | null {
  if (rate === null) {
    return null;
  }
  // Number(...) makes sure we are multiplying numbers, not strings.
  return Math.round(Number(price) * rate * 100) / 100;
}

// Prices are stored with two decimals. Adding them as whole cents avoids
// floating-point errors such as 0.1 + 0.2 = 0.30000000000000004.
function cents(price: number): number {
  return Math.round(Number(price) * 100);
}

// @Controller() marks the class as a set of HTTP routes. No prefix is given,
// so each route below uses its full path (e.g. /cities).
// The controller reads the parameters and builds the response. The database
// stays in TravelService; weather and exchange rates go through ExternalService.
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

  // ---------------------------------------------------------------------------
  // PROPOSED SOLUTION 1 (guided example): flight + weather at arrival.
  // GET /flights/1/weather
  // Sequential composition: first the internal data, then the external request,
  // built with the coordinates of the destination and the arrival time.
  // 400: invalid ID; 404: flight not found; 200: flight with weather or "unavailable".
  // ---------------------------------------------------------------------------
  @Get("flights/:id/weather")
  async getFlightWeather(@Param("id", ParseIntPipe) id: number) {
    // 1. The service loads the flight together with arrivalCity, so no second
    //    query is needed to get the coordinates of the destination.
    const flight = await this.travel.flight(requirePositiveId(id));

    // 2. arrivalTime is passed as the optional third parameter of
    //    ExternalService.weather. Without a date, that method returns the
    //    current weather.
    // 3. available catches timeouts, invalid responses and dates outside the
    //    forecast range: the flight is still returned when the weather is missing.
    const weather = await available(
      this.external.weather(
        flight.arrivalCity.latitude,
        flight.arrivalCity.longitude,
        flight.arrivalTime,
      ),
    );

    // 4. The internal data stays separate from the result of the external call.
    //    weather.data.time is the start of the UTC hour that contains the arrival:
    //    for example, arrival at 17:10Z -> forecast of 17:00Z.
    return { flight, weather };
  }

  // ---------------------------------------------------------------------------
  // PROPOSED SOLUTION 2: hotel + currency conversion.
  // GET /hotels/1/price?currency=USD (the currency is required: 400 if missing).
  // The price of a hotel in the database is in the currency of its city
  // (city.currency): London in GBP, Tokyo in JPY, ... The conversion starts there.
  // Same pattern as the first example: internal data -> external API -> combined answer.
  // ---------------------------------------------------------------------------
  @Get("hotels/:id/price")
  async getHotelPrice(
    @Param("id", ParseIntPipe) id: number,
    @Query("currency") requestedCurrency?: string,
  ) {
    // Validate the input before contacting the database or an external provider.
    const currency = parseCurrency(requestedCurrency);
    const hotel = await this.travel.hotel(requirePositiveId(id));

    // The rate goes from the currency of the hotel (that of its city) to the
    // requested currency. available turns a Frankfurter failure into
    // { status: "unavailable" } instead of an error.
    const exchange = await available(
      this.external.rate(hotel.city.currency, currency),
    );
    const rate = exchange.status === "ok" ? exchange.data : null;

    // The original price is not overwritten, neither in the entity nor in the
    // database. If the rate fails: HTTP 200, pricePerNight is null and the
    // original amount is still returned.
    return {
      hotel,
      originalPricePerNight: hotel.pricePerNight,
      originalCurrency: hotel.city.currency,
      currency,
      exchange,
      pricePerNight: convertPrice(hotel.pricePerNight, rate),
    };
  }

  // ---------------------------------------------------------------------------
  // PROPOSED SOLUTION 3: business logic, cheapest flight + cheapest hotel.
  // GET /cities/3/cheapest-trip?currency=USD (the currency is required).
  // Contract of the lab: one inbound flight from any origin + ONE night in a
  // hotel, both for the requested city. The flight is priced in EUR, the hotel
  // in the currency of the city: the total is in the requested currency.
  // This is not an availability check: the model has no rooms, check-in dates
  // or bookings.
  // 400 if the currency is invalid; 404 if the city does not exist or one of
  // the two parts is missing.
  // ---------------------------------------------------------------------------
  @Get("cities/:id/cheapest-trip")
  async getCheapestTrip(
    @Param("id", ParseIntPipe) id: number,
    @Query("currency") requestedCurrency?: string,
  ) {
    const currency = parseCurrency(requestedCurrency);
    const city = await this.travel.city(requirePositiveId(id));

    // The four calls are independent, so they start together:
    // - flights and hotels come from the database (a database error propagates:
    //   available is reserved for external data);
    // - flight rate: EUR -> requested currency;
    // - hotel rate: city currency -> requested currency.
    const [flights, hotels, flightExchange, hotelExchange] = await Promise.all([
      this.travel.flightsTo(city.id),
      this.travel.hotelsIn(city.id),
      available(this.external.rate("EUR", currency)),
      available(this.external.rate(city.currency, currency)),
    ]);
    if (flights.length === 0 || hotels.length === 0) {
      throw new NotFoundException("No flight-hotel combination for this city");
    }

    // Every flight can be combined with every hotel of the same destination and
    // there are no package discounts, so min(flight + hotel) = min(flight) + min(hotel).
    // Two scans are enough, O(flights + hotels), without building all the pairs.
    // Prices are compared in whole cents; on a tie the lowest ID wins, so the
    // result does not depend on the order of the query results.
    const flight = flights.reduce((best, candidate) => {
      const difference = cents(candidate.priceEur) - cents(best.priceEur);
      return difference < 0 || (difference === 0 && candidate.id < best.id)
        ? candidate
        : best;
    });
    const hotel = hotels.reduce((best, candidate) => {
      const difference =
        cents(candidate.pricePerNight) - cents(best.pricePerNight);
      return difference < 0 || (difference === 0 && candidate.id < best.id)
        ? candidate
        : best;
    });

    const flightPrice = convertPrice(
      flight.priceEur,
      flightExchange.status === "ok" ? flightExchange.data : null,
    );
    const pricePerNight = convertPrice(
      hotel.pricePerNight,
      hotelExchange.status === "ok" ? hotelExchange.data : null,
    );
    // The total exists only if both rates are available.
    const totalPrice =
      flightPrice === null || pricePerNight === null
        ? null
        : (cents(flightPrice) + cents(pricePerNight)) / 100;

    // The original prices stay inside flight (EUR) and hotel (currency of the
    // city); the converted amounts are null when a rate is unavailable.
    return {
      city,
      flight,
      hotel,
      nights: 1,
      currency,
      flightExchange,
      hotelExchange,
      flightPrice,
      pricePerNight,
      totalPrice,
    };
  }

  //@Get("flights/:id/price")
  //async getFlightPrice( @Param("id", ParseIntPipe) id: number,@Query("currency") requestedCurrency?: string) {
    
  //}
}
