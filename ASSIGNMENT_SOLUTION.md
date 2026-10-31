# Solution: `GET /flights/:id/price`

Do not distribute.

Service (`travel.service.ts`): the logic.

```ts
async flightPrice(id: number, requestedCurrency?: string) {

  const currency = parseCurrency(requestedCurrency);
  const flight = await this.flight(id);
  const exchange = await available(this.external.rate("EUR", currency));
  const price + convertPrice(flight.priceEur, rateOf(exchange));

  return {
    flight,
    currency,
    exchange,
    price
  };
}
```

## Notes

- `ExternalService.rate(from, to)` returns a number directly. The source currency is always `"EUR"` (flight prices are in EUR); the target is the requested currency.
- `currency` is required, like in the hotel and cheapest-trip endpoints: `parseCurrency` answers `400` when it is missing or not three letters. (It is not defaulted to EUR.)
- The currency is validated before the database is queried, as in `hotelPrice`. If both the ID and the currency are invalid the answer is `400`; if the ID does not exist but the currency is valid, `404`. Swapping the two lines is also acceptable.
- `this.flight(id)` already rejects IDs below 1 with `400` and unknown IDs with `404`; `ParseIntPipe` rejects non-numeric IDs with `400`.
- `rate("EUR", "EUR")` still calls Frankfurter (the implementation does not short-circuit), so an upstream failure makes `exchange` unavailable even for EUR. An unsupported but well-formed code (`ZZZ`) gives `200` with `unavailable`, not an error.
- `rateOf(exchange)` is `exchange.data` when the status is `ok`, otherwise `null`; `convertPrice` returns `null` for a `null` rate and rounds to 2 decimals otherwise.

## Common mistakes

- Forgetting `available(...)`: a Frankfurter failure becomes a `500` instead of `200` with `unavailable`.
- Reading `exchange.data.rate` instead of `exchange.data` (the service already returns the number).
- Computing the price without `convertPrice` (no rounding, and a crash when the rate is missing).
- Putting the logic in the controller instead of the service.
- Using the wrong direction of the rate (`currency` -> `EUR`) or the hotel's city currency instead of `"EUR"`.
