# Solution: `GET /flights/:id/price`

Do not distribute.

```ts
@Get('flights/:id/price')
async getFlightPrice(
  @Param('id', ParseIntPipe) id: number,
  @Query('currency') requestedCurrency?: string,
) {
  const flight = await this.travel.flight(requirePositiveId(id));
  const currency = parseCurrency(requestedCurrency);
  const exchange = await available(this.external.rate(currency));
  const rate = exchange.status === 'ok' ? exchange.data.rate : null;
  return { flight, currency, exchange, price: convertPrice(flight.priceEur, rate) };
}
```

Notes: the flight is loaded first, so an unknown ID gives 404 even if the currency is also invalid (either order is acceptable). With `EUR` or no currency, `rate()` returns 1 without calling Frankfurter. Common mistakes: forgetting `available` (a Frankfurter failure becomes a 500), and computing the price without `convertPrice`.
