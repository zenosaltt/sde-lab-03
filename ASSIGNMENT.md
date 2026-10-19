# Assignment: flight price in another currency (about 10 minutes)

Implement `GET /flights/:id/price?currency=USD` in `TravelController`. It returns a flight with its price converted from EUR into the requested currency, using the Frankfurter exchange rate.

Prerequisite: complete the guided `ExternalService.rate` example in `nest-backend/src/service/external.service.ts`. It returns `Promise<number>` (for example, `1.08`), so `available(...)` puts the number directly in `exchange.data`.

## Response

```json
{
  "flight": { "id": 1, "airline": "Demo Air", "priceEur": 120, ... },
  "currency": "USD",
  "exchange": { "status": "ok", "data": 1.08 },
  "price": 129.6
}
```

`price = flight.priceEur * rate`, rounded to 2 decimals.

## Behaviour

| Situation | Result |
| --- | --- |
| Flight does not exist | `404` |
| `currency` is not three letters (e.g. `?currency=ab`) | `400` |
| `currency` missing | `EUR` is used, `price` equals `priceEur` |
| Frankfurter is down | `200`, `exchange: { "status": "unavailable" }`, `price: null` |

## Steps

Everything you need already exists in the file. Look at `getTravelOptions` and copy the pattern.

1. Add `@Get('flights/:id/price')`. Take `id` with `@Param('id', ParseIntPipe)` and the currency with `@Query('currency')`.
2. Load the flight: `this.travel.flight(requirePositiveId(id))`.
3. Validate the currency: `parseCurrency(requestedCurrency)`.
4. Ask for the rate: `available(this.external.rate(currency))`.
5. Compute the price with `convertPrice(flight.priceEur, rate)`, where `rate` is `exchange.data` if `exchange.status === 'ok'`, otherwise `null`.
6. Return `{ flight, currency, exchange, price }`.

## Test

- `/flights/1/price?currency=USD` -> 200, price about 1.08 times 120
- `/flights/1/price` -> price 120
- `/flights/1/price?currency=ab` -> 400
- `/flights/999/price?currency=USD` -> 404

## Deliverable

The JSON of one successful call and the status code of one error case.
