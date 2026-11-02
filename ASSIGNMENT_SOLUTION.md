# Solution: `GET /cities/:id/cheapest-hotel-weather`

Do not distribute.

Service (`travel.service.ts`): the logic.

```ts
async cheapestHotelWeather(cityId: number, requestedCurrency?: string) {
  const hotel = await this.cheapestHotelIn(cityId);

  requestedCurrency = parseCurrency(requestedCurrency);
  const hotelCurrency = parseCurrency(hotel.city.currency);
  const hotelExchange = await available(
    this.external.rate(hotelCurrency, requestedCurrency),
  );
  const price = convertPrice(hotel.pricePerNight, rateOf(hotelExchange));

  const weather = await available(
    this.external.weather(hotel.city.latitude, hotel.city.longitude),
  );

  return { hotel, hotelExchange, price, weather };
}
```

Controller (`travel.controller.ts`): delegate to the service.

```ts
@Get("cities/:id/cheapest-hotel-weather")
getCheapestHotelWeather(
  @Param("id", ParseIntPipe) id: number,
  @Query("currency") currency?: string,
) {
  return this.travel.cheapestHotelWeather(id, currency);
}
```

## Notes

- `cheapestHotelIn` loads the hotel with its city, sorts by original nightly price then hotel ID, and throws `404` when no hotel exists for that city. There is no separate city lookup. The cheapest hotel is selected before currency conversion.
- The hotel lookup precedes currency validation in this solution. If no hotel is found, the answer is `404` even when the currency is invalid. `ParseIntPipe` rejects non-integer IDs before entering the service; numeric IDs with no matching hotel also produce `404`.
- `parseCurrency` requires three letters and normalizes to uppercase. The source currency is `hotel.city.currency`, not always EUR. `ExternalService.rate` returns a number directly.
- `available` wraps each external call separately. A failed exchange makes `price` null but does not prevent the weather call. A failed weather call preserves the hotel and exchange result. Even when both fail, the response is `200` with the hotel.
- `convertPrice` rounds to two decimals; `rateOf` supplies null for an unavailable exchange. The original `hotel.pricePerNight` is never overwritten.
- Omitting the date in `weather` uses the current UTC hour at the city's coordinates, with the existing optional Redis cache. No flight or arrival time is involved.
- The frontend reads the target currency from the submitted request and reuses the hotel, exchange and weather cards. It displays the original hotel price with an unavailable conversion message if `price` is null.

## Common mistakes

- Treating the URL ID as a hotel ID rather than a city ID.
- Using EUR as the source currency for every hotel or reversing the rate direction.
- Reading `hotelExchange.data.rate` instead of `hotelExchange.data`.
- Forgetting `available` around either external call, so a provider failure prevents the composed response.
- Skipping the weather call when the exchange fails.
- Passing a flight arrival date to `weather`, instead of requesting current weather.
- Returning a different price key: this contract uses `price`, not `pricePerNight`.
- Putting business logic in the controller rather than in the service.
