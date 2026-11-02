# Assignment: cheapest hotel, converted price and weather (about 10 minutes)

Implement `GET /cities/:id/cheapest-hotel-weather?currency=USD`. Given a city ID, return its cheapest hotel, the nightly price converted into the requested currency using Frankfurter, and the current weather in that city using Open-Meteo.

The logic goes in `TravelService` (`nest-backend/src/service/travel.service.ts`, method `cheapestHotelWeather`); the route goes in `TravelController` (`nest-backend/src/controller/travel.controller.ts`) and only calls the service. Reuse `cheapestHotelIn`, `parseCurrency`, `available`, `rateOf`, `convertPrice` and `ExternalService`.

## Response

Example for a hotel whose city uses GBP (exchange rate and weather are illustrative):

```json
{
  "hotel": {
    "id": 7,
    "name": "Demo Hotel",
    "pricePerNight": 80,
    "city": {
      "id": 3,
      "name": "London",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "currency": "GBP"
    }
  },
  "hotelExchange": { "status": "ok", "data": 1.25 },
  "price": 100,
  "weather": {
    "status": "ok",
    "data": {
      "temperature_2m": 15,
      "temperatureUnit": "°C",
      "weather_code": 3,
      "time": "2026-11-02T12:00:00.000Z"
    }
  }
}
```

`price` is the converted price for **one night**, rounded to two decimals. Keep the original hotel object unchanged. The target currency is taken from the request; it is not a field in this response.

## Behaviour

| Situation | Result |
| --- | --- |
| City has hotels | Select the lowest `pricePerNight`, then the lowest hotel ID on a tie |
| City has no hotels, or does not exist | `404`, `No hotel for this city` |
| ID is not an integer (e.g. `abc`) | `400` from `ParseIntPipe` |
| `currency` missing or not three letters, after a hotel is found | `400` |
| Frankfurter fails or does not support the currency (e.g. `ZZZ`) | `200`, `hotelExchange: { "status": "unavailable" }`, `price: null`; still request weather |
| Open-Meteo fails | `200`, `weather: { "status": "unavailable" }`; keep the hotel and converted price |
| Both external services fail | `200`, both external results `unavailable`, `price: null`; keep the hotel |

## Steps

1. In the controller, add `@Get("cities/:id/cheapest-hotel-weather")`. Take `id` with `@Param("id", ParseIntPipe)` and the currency with `@Query("currency")`, then return `this.travel.cheapestHotelWeather(id, currency)`.
2. Load the cheapest hotel with `this.cheapestHotelIn(cityId)`. It already includes the city, its currency and coordinates. The ID in the URL is a **city ID**, not a hotel ID.
3. Normalize and validate the requested currency and `hotel.city.currency` with `parseCurrency`.
4. Get `hotelExchange` with `available(this.external.rate(hotelCurrency, requestedCurrency))`. Hotel prices are in the city currency, which may differ from EUR. The rate is directly in `hotelExchange.data`, not `.data.rate`.
5. Calculate `price` with `convertPrice(hotel.pricePerNight, rateOf(hotelExchange))`.
6. Get `weather` with `available(this.external.weather(hotel.city.latitude, hotel.city.longitude))`. Omit the date to use the current UTC hour. This is independent of any flight arrival time.
7. Return `{ hotel, hotelExchange, price, weather }`.

## Test

Check the real city IDs first (`GET /cities` or the tables in the web interface): they change on every `./start-lab.sh`. Choose a city with hotels. The web interface menu has the entry *Assignment: GET /cities/:id/cheapest-hotel-weather* and displays hotel, exchange and weather cards.

- `/cities/3/cheapest-hotel-weather?currency=USD` -> `200`, cheapest hotel, converted nightly price and weather (or external results marked `unavailable`).
- Repeat for a city with a non-EUR currency and check that the conversion starts from `hotel.city.currency`.
- `/cities/3/cheapest-hotel-weather?currency=usd` -> same target currency as `USD`.
- `/cities/3/cheapest-hotel-weather` or `?currency=ab` -> `400` when the city has a hotel.
- `/cities/999999/cheapest-hotel-weather?currency=USD` -> `404` if the city has no hotels.
- `/cities/abc/cheapest-hotel-weather?currency=USD` -> `400`.
- `/cities/3/cheapest-hotel-weather?currency=ZZZ` -> `200`, `hotelExchange.status` is `unavailable`, `price` is `null`, and weather is still requested.
- With either external provider unavailable, verify that the other result and the hotel are still returned.

## Deliverable

A screenshot (or JSON) of one successful call, plus two lines explaining an observed error case.
