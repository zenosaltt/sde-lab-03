# Assignment: flight price in another currency (about 10 minutes)

Implement `GET /flights/:id/price?currency=USD`. It returns a flight with its price converted from EUR into the requested currency, using the Frankfurter exchange rate.

The logic goes in `TravelService` (`nest-backend/src/service/travel.service.ts`, method `flightPrice`); the route goes in `TravelController` (`nest-backend/src/controller/travel.controller.ts`) and only calls the service. Use the existing `ExternalService.rate(from, to)`: it returns `Promise<number>` (for example `1.08`), so `available(...)` puts the number directly in `exchange.data`.

## Response

```json
{
  "flight": { "id": 1, "airline": "Demo Air", "priceEur": 120, ... },
  "currency": "USD",
  "exchange": { "status": "ok", "data": 1.08 },
  "price": 129.6
}
```

`price = flight.priceEur * rate`, rounded to 2 decimals. `flight` is the full object, with `departureCity` and `arrivalCity`.

## Behaviour

| Situation | Result |
| --- | --- |
| Flight does not exist | `404` |
| ID is not a positive integer (`abc`, `0`) | `400` |
| `currency` missing or not three letters (e.g. `?currency=ab`) | `400` |
| Frankfurter is down or does not support the currency (e.g. `ZZZ`) | `200`, `exchange: { "status": "unavailable" }`, `price: null` |

## Steps

Everything you need already exists in `travel.service.ts`. Read `hotelPrice` (same pattern: internal data, then Frankfurter) and adapt it. The difference: the price of a flight is always in EUR, so the rate goes from `"EUR"` to the requested currency.

1. In the controller, add `@Get("flights/:id/price")`. Take `id` with `@Param("id", ParseIntPipe)` and the currency with `@Query("currency")`, then return `this.travel.flightPrice(id, currency)`.
2. In the service, validate the currency: `parseCurrency(requestedCurrency)`.
3. Load the flight: `this.flight(id)` (it already answers 400/404).
4. Ask for the rate: `available(this.external.rate("EUR", currency))`.
5. Compute the price with `convertPrice(flight.priceEur, rateOf(exchange))`.
6. Return `{ flight, currency, exchange, price }`.

## Test

Check the real IDs first (`GET /flights` or the tables in the web interface): they change on every `./start-lab.sh`. The menu of the web interface has the entry *Assignment: GET /flights/:id/price*.

- `/flights/1/price?currency=USD` -> 200, `price` = `priceEur` times the rate
- `/flights/1/price?currency=EUR` -> 200, `price` equals `priceEur`
- `/flights/1/price` -> 400
- `/flights/1/price?currency=ab` -> 400
- `/flights/999/price?currency=USD` -> 404
- `/flights/1/price?currency=ZZZ` -> 200, `exchange.status` is `unavailable`, `price` is `null`

## Deliverable

A screenshot (or JSON) of one successful call.