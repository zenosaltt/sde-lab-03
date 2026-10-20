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
  const exchange = await available(this.external.rate("EUR", currency));
  const rate = exchange.status === 'ok' ? exchange.data : null;
  return { flight, currency, exchange, price: convertPrice(flight.priceEur, rate) };
}
```

Notes: `ExternalService.rate(from, to)` returns a number directly. Pass `"EUR"` as the source currency and the requested currency as the target. The current implementation calls Frankfurter even when both currencies are EUR, so upstream failures can also make the default-currency exchange unavailable. The flight is loaded first, so an unknown ID gives 404 even if the currency is also invalid (either order is acceptable). Common mistakes: forgetting `available` (a Frankfurter failure becomes a 500), reading `exchange.data.rate` instead of `exchange.data`, and computing the price without `convertPrice`.
