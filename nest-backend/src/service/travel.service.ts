import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { City } from "../model/city.entity.ts";
import { Flight } from "../model/flight.entity.ts";
import { Hotel } from "../model/hotel.entity.ts";
import { ExternalService } from "./external.service.ts";

// Result of a call that may fail: either { status: 'ok', data: ... } or
// { status: 'unavailable' }. The "|" means "one or the other"; <T> is the type
// of the data (e.g. the weather object or the exchange rate number).
type Available<T> = { status: "ok"; data: T } | { status: "unavailable" };
// Placeholder for the lab blanks: replace each TODO with the right expression.
// Typed `any` so it compiles in any slot; at runtime it is `undefined`, so
// external calls fail -> "unavailable", and an unfinished exercise answers 501.
const TODO: any = undefined;
// Waits for a promise (e.g. an external API call) and NEVER throws.
// - success -> { status: 'ok', data: <result> }
// - failure (timeout, HTTP error, invalid response) -> { status: 'unavailable' }
// This is what lets the endpoints answer 200 even if Open-Meteo or Frankfurter is down.
async function available<T>(promise: Promise<T>): Promise<Available<T>> {
  try {
    return { status: "ok", data: await promise };
  } catch {
    // We ignore the error details: the client only needs to know it is unavailable.
    return { status: "unavailable" };
  }
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
  if (rate === null) return null;
  return Math.round(price * rate * 100) / 100;
}

// The rate of an Available result, or null when the exchange service failed.
function rateOf(exchange: Available<number>): number | null {
  filled(exchange, "the exchange result");
  if (exchange.status === "ok") return exchange.data;
  return null;
}

// Throws 501 if a lab blank has not been filled in yet (it is still TODO),
// so an unfinished exercise fails visibly instead of crashing or returning nulls.
function filled<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new NotImplementedException(
      `Exercise incomplete: ${name} is still TODO`,
    );
  }
  return value;
}

// Relations loaded with every flight: its departure and arrival city.
const FLIGHT_RELATIONS = { departureCity: true, arrivalCity: true } as const;

// SERVICE
// Contains ALL the logic of the lab: the local data (MySQL), the validation of
// the inputs and the composition with the external APIs (through ExternalService).
// It knows nothing about HTTP routes: the controller only calls its methods.

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
    private readonly external: ExternalService,
  ) {}

  // SELECT * FROM cities ORDER BY id. The order makes the output stable.
  allCities() {
    return this.cities.find({ order: { id: "ASC" } });
  }

  // "relations" tells TypeORM to also load the linked cities (JOIN), so each
  // flight contains the full departureCity and arrivalCity, not just their IDs.
  allFlights() {
    return this.flights.find({
      relations: FLIGHT_RELATIONS,
      order: { id: "ASC" },
    });
  }

  // Same idea for hotels: each hotel includes its city.
  allHotels() {
    return this.hotels.find({
      relations: { city: true },
      order: { id: "ASC" },
    });
  }

  // Shared by city/flight/hotel: IDs start from 1 (otherwise 400), and a missing
  // row throws NotFoundException (404).
  private async load<T>(id: number, name: string, query: () => Promise<T | null>): Promise<T> {
    filled(id, "the ID");
    if (!(id >= 1)) throw new BadRequestException("ID must be positive");
    const row = await query();
    if (!row) throw new NotFoundException(`${name} not found`);
    return row;
  }

  city(id: number): Promise<City> {
    return this.load(id, "City", () => this.cities.findOneBy({ id }));
  }

  // The flight is returned together with its departure and arrival city.
  flight(id: number): Promise<Flight> {
    return this.load(id, "Flight", () =>
      this.flights.findOne({ where: { id }, relations: FLIGHT_RELATIONS }),
    );
  }

  hotel(id: number): Promise<Hotel> {
    return this.load(id, "Hotel", () =>
      this.hotels.findOne({ where: { id }, relations: { city: true } }),
    );
  }

  // Used by the seed only: the data is typed and trusted, so there is no validation.
  createCity(data: { name: string; latitude: number; longitude: number; currency: string }) {
    return this.cities.save(this.cities.create(data));
  }

  createFlight(data: { departureCity: City; 
    arrivalCity: City; 
    departureTime: Date; 
    arrivalTime: Date; 
    airline: string; 
    priceEur: number 
  }) {
    return this.flights.save(this.flights.create(data));
  }

  createHotel(data: { city: City; name: string; pricePerNight: number }) {
    return this.hotels.save(this.hotels.create(data));
  }

  // The cheapest hotel of one city (lowest ID on a tie), or 404 if it has none.
  async cheapestHotelIn(cityId: number): Promise<Hotel> {
    const hotel = await this.hotels.findOne({
      where: { city: { id: cityId } },
      relations: { city: true },
      order: { pricePerNight: "ASC", id: "ASC" },
    });
    if (!hotel) throw new NotFoundException("No hotel for this city");
    return hotel;
  }

  // The cheapest flight ARRIVING in the city (lowest ID on a tie), or 404 if there is none.
  async cheapestFlightTo(cityId: number): Promise<Flight> {
    const flight = await this.flights.findOne({
      where: { arrivalCity: { id: cityId } },
      relations: FLIGHT_RELATIONS,
      order: { priceEur: "ASC", id: "ASC" },
    });
    if (!flight) throw new NotFoundException("No flight for this city");
    return flight;
  }

  // External exchange rate

  // GET /rate/GBP/USD -> exchange rate between two currencies, taken directly
  // from Frankfurter. GET /rate/USD means EUR -> USD (EUR is the default
  // source, set in the controller). No database is involved.
  async rate(from: string, to: string) {
    // Validate both codes (three letters, upper case); invalid -> 400.
    const source = parseCurrency(from);
    const target = parseCurrency(to);

    // available(...) turns an external failure into { status: 'unavailable' }
    // instead of an error, so the answer is still 200.
    return available(this.external.rate(source, target));
  }

  // (EXAMPLE 2): flight + weather at arrival.
  // GET /flights/1/weather
  // Sequential composition: first the internal data, then the external request,
  // built with the coordinates of the destination and the arrival time.
  // 400: invalid ID; 404: flight not found; 200: flight with weather or "unavailable".
  async flightWeather(flightId: number) {
    // 1. The flight is loaded together with arrivalCity, so no second query is
    //    needed to get the coordinates of the destination.
    const flight = await this.flight(flightId);

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

  // (EXERCISE 1): hotel + currency conversion.
  // GET /hotels/1/price?currency=USD (the currency is required: 400 if missing).
  // The price of a hotel in the database is in the currency of its city
  // (city.currency): London in GBP, Tokyo in JPY, ... The conversion starts there.
  // Same pattern as the first example: internal data -> external API -> combined answer.
  async hotelPrice(hotelId: number, requestedCurrency?: string) {
    // Validate the input before contacting the database or an external provider.
    const currency = parseCurrency(requestedCurrency);
    
    const hotel = TODO; // HINT: await ... (Take a look at the method in line 140) 

    // The rate goes from the currency of the hotel (that of its city) to the
    // requested currency. available turns a Frankfurter failure into
    // { status: "unavailable" } instead of an error.
    const exchange = TODO // HINT:  await + ... (Look at lines 192-200)
    

    // The original price is not overwritten, neither in the entity nor in the
    // database. If the rate fails: HTTP 200, pricePerNight is null and the
    // original amount is still returned.
    return {
      hotel: filled(hotel, "hotel"),
      currency,
      exchange: filled(exchange, "exchange"),
      convertedPricePerNight: convertPrice(hotel.pricePerNight, rateOf(exchange)),
    };
  }

  // EXERCISE 2: business logic, cheapest flight + cheapest hotel.
  // GET /cities/3/cheapest-trip?currency=USD (the currency is required).
  // Contract of the lab: one inbound flight from any origin + ONE night in a
  // hotel, both for the requested city. The flight is priced in EUR, the hotel
  // in the currency of the city: the total is in the requested currency.
  // This is not an availability check: the model has no rooms, check-in dates
  // or bookings.
  // 400 if the currency is invalid; 404 if the city does not exist or one of
  // the two parts is missing.
  async cheapestTrip(cityId: number, requestedCurrency?: string) {
    
    const currency = parseCurrency(requestedCurrency);
    const city = await this.city(cityId);

    // The four calls are independent, so they start together:
    // - the cheapest flight and hotel come from the database (404 if the city
    //   has none; a database error propagates: available is for external data);
    // - flight rate: EUR -> requested currency;
    // - hotel rate: city currency -> requested currency.
    // Every flight can be combined with every hotel of the same destination and
    // there are no package discounts, so min(flight + hotel) = min(flight) + min(hotel).
    const [flight, hotel, flightExchange, hotelExchange] = await Promise.all([
      this.cheapestFlightTo(cityId),
      this.cheapestHotelIn(cityId),
      available(this.external.rate(TODO, TODO)), // TODO: flight rate
      available(this.external.rate(TODO, TODO)), // TODO: hotel rate
    ]);

    const convertedFlightPrice = convertPrice(flight.priceEur, rateOf(flightExchange));
    // HINT: look at flightPrice
    const convertedHotelPrice = TODO 

    // The original prices stay inside flight (EUR) and hotel (currency of the
    // city); the converted amounts are null when a rate is unavailable.
    return {
      flight,
      hotel,
      flightExchange,
      hotelExchange,
      convertedFlightPrice,
      convertedHotelPrice: filled(convertedHotelPrice, "convertedHotelPrice"),
    };
  }

  // ASSIGNMENT: cheapest hotel + converted price + current weather.
  // GET /cities/3/cheapest-hotel-weather?currency=USD (currency is required).
  // The ID identifies a CITY, not a hotel. The cheapest hotel is chosen by its
  // original price in the city currency, with the lowest hotel ID on a tie.
  // No flight, booking dates or availability checks are involved.
  // Composition: local hotel -> Frankfurter conversion -> Open-Meteo weather.
  // 404 if the city has no hotel (including a non-existent city); 400 for an
  // invalid currency after a hotel is found. ParseIntPipe rejects non-integer IDs.
  // External failures still produce 200, with each failed result "unavailable".
  async cheapestHotelWeather(cityId: number, requestedCurrency?: string) {
    // 1. Load the cheapest hotel with its city: the relation supplies both the
    //    source currency and the coordinates, without another city query.
    const hotel = await this.cheapestHotelIn(cityId);

    // 2. Normalize and validate the requested and source currency codes.
    //    The rate starts from hotel.city.currency (not necessarily EUR).
    requestedCurrency = parseCurrency(requestedCurrency);
    const hotelCurrency = parseCurrency(hotel.city.currency);

    const hotelExchange = TODO; // HINT: look at exercise 2;

    // Round to two decimals; a missing rate gives null. The original hotel
    // price is preserved, so the client can still display it on failure.
    const convertedPrice = convertPrice(hotel.pricePerNight, rateOf(hotelExchange));

    // 3. No date is passed: weather uses the current UTC hour at the hotel's
    //    city coordinates. This call still runs if the exchange is unavailable;
    //    a weather failure likewise does not discard the hotel or its price.
    const weather = TODO; // HINT: look at example 2;

    // 4. Keep internal data, exchange result, converted nightly price and
    //    weather separate. The target currency is known from the request.
    return { 
      hotel, 
      hotelExchange: filled(hotelExchange, "hotelExchange"), 
      convertedPrice, 
      weather: filled(weather, "weather"), 
    };
  }

  async clearDB(): Promise<void> {
    await this.hotels.deleteAll();
    await this.flights.deleteAll();
    await this.cities.deleteAll();
  }
}
