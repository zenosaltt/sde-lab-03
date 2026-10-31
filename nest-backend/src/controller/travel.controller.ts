import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { TravelService } from "../service/travel.service.ts";

// @Controller() marks the class as a set of HTTP routes. No prefix is given,
// so each route below uses its full path (e.g. /cities).
// The controller only maps each route to ONE call of TravelService: parameters
// in, result out. Validation, database access and the calls to the external
// APIs (all the exercises) are written in the service.
@Controller()
export class TravelController {
  // NestJS creates the service and passes it here (dependency injection).
  constructor(private readonly travel: TravelService) {}

  // GET /cities -> list of all cities.
  @Get("cities")
  getCities() {
    return this.travel.allCities();
  }

  // GET /cities/3 -> one city. ":id" is a path parameter.
  // ParseIntPipe converts "3" into the number 3 (and answers 400 for "abc").
  // The service answers 400 for 0 or negatives and 404 if the city does not exist.
  @Get("cities/:id")
  getCity(@Param("id", ParseIntPipe) id: number) {
    return this.travel.city(id);
  }

  // GET /flights -> all flights, with departure and arrival city.
  @Get("flights")
  getFlights() {
    return this.travel.allFlights();
  }

  // GET /flights/:id -> one flight (400 for an invalid ID, 404 if it does not exist).
  @Get("flights/:id")
  getFlight(@Param("id", ParseIntPipe) id: number) {
    return this.travel.flight(id);
  }

  // GET /hotels -> all hotels, each with its city.
  @Get("hotels")
  getHotels() {
    return this.travel.allHotels();
  }

  // GET /hotels/:id -> one hotel (400 invalid ID, 404 not found).
  @Get("hotels/:id")
  getHotel(@Param("id", ParseIntPipe) id: number) {
    return this.travel.hotel(id);
  }

  // GET /rate/EUR/USD -> exchange rate between two currencies (example 1, see the service).
  @Get("rate/:from/:to")
  getRate(@Param("from") from: string, @Param("to") to: string) {
    return this.travel.rate(from, to);
  }

  // GET /flights/1/weather -> flight + weather at arrival (example, see the service).
  @Get("flights/:id/weather")
  getFlightWeather(@Param("id", ParseIntPipe) id: number) {
    return this.travel.flightWeather(id);
  }

  // GET /hotels/1/price?currency=USD -> hotel price converted (exercise 1, see the service).
  @Get("hotels/:id/price")
  getHotelPrice(
    @Param("id", ParseIntPipe) id: number,
    @Query("currency") currency?: string,
  ) {
    return this.travel.hotelPrice(id, currency);
  }

  // GET /cities/3/cheapest-trip?currency=USD -> cheapest flight + hotel (exercise 2, see the service).
  @Get("cities/:id/cheapest-trip")
  getCheapestTrip(
    @Param("id", ParseIntPipe) id: number,
    @Query("currency") currency?: string,
  ) {
    return this.travel.cheapestTrip(id, currency);
  }

  // GET /flights/1/price?currency=USD -> flight price converted from EUR (assignment, see the service).
  @Get("flights/:id/price")
  getFlightPrice(
    @Param("id", ParseIntPipe) id: number,
    @Query("currency") currency?: string,
  ) {
    return this.travel.flightPrice(id, currency);
  }
}
