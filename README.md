# Advanced REST lab

Teaching draft for a **2-hour** lab. A NestJS API combines three local resources stored in MySQL (cities, flights, hotels) with two external services: [Open-Meteo](https://open-meteo.com/en/docs) for the weather and [Frankfurter](https://frankfurter.dev/) for exchange rates.

## Structure

```text
sde-lab-03/
├── .env                              lab credentials
├── README.md                         lab description
├── ASSIGNMENT.md                     assignment for the students
├── ASSIGNMENT_SOLUTION.md            teacher solution (do not distribute)
├── docker-compose.yml                backend, MySQL and Redis
├── start-lab.sh                      starts Docker and seeds the database
└── nest-backend/
    ├── Dockerfile                    Node.js environment for the lab
    ├── package.json
    ├── tsconfig.json
    ├── public/                       web interface to try the APIs
    │   ├── index.html
    │   ├── style.css
    │   ├── app.js
    │   ├── plane.svg
    │   └── sun.svg
    ├── seed/                         demo data and seeding script
    │   ├── seed.ts                   entry point (npm run seed)
    │   ├── run-seed.ts               clears the database and inserts the data
    │   └── seed-data.ts              cities, flights and hotels
    └── src/
        ├── main.ts                   starts the app and serves public/
        ├── app.module.ts             database and modules configuration
        ├── controller/
        │   └── travel.controller.ts  HTTP routes (the exercises are written here)
        ├── service/
        │   ├── travel.service.ts     database access (TypeORM)
        │   └── external.service.ts   Open-Meteo, Frankfurter and the Redis cache
        ├── model/
        │   ├── city.entity.ts
        │   ├── flight.entity.ts
        │   └── hotel.entity.ts
        └── module/
            └── travel.module.ts      NestJS module
```

The database contains only `City`, `Flight` and `Hotel`. Flights and hotels refer to existing cities. **The price of a flight is in EUR** (`priceEur`); **the price of a hotel is in the currency of its city** (`city.currency`: London in GBP, Tokyo in JPY, ...). Values in another currency are computed only in the aggregated responses, without changing the database. The weather is cached in Redis for 10 minutes. The API has no authentication and the data is for practice only.

## Setup

You only need Docker and Docker Compose. Node.js and npm are included in the backend container.

The `.env` file with the lab credentials is included in the repository. From the project root, start the environment and seed the database:

```bash
./start-lab.sh
```

The script runs these commands, which can also be used separately:

```bash
docker compose down -v
docker compose up -d --build --renew-anon-volumes
docker compose exec backend npm run seed
docker compose logs -f backend
```

The backend waits for MySQL to be ready. Inside the Docker network it uses `mysql` and `redis` as hosts, regardless of the local hosts in `.env`. The tables are created automatically by TypeORM (`synchronize: true`), which is convenient for the lab.

### Trying the APIs

Once the environment is running, the API answers on `http://localhost:3000`. There are two ways to try it:

| | Web interface | Terminal |
| --- | --- | --- |
| **How to use it** | open [http://localhost:3000](http://localhost:3000) in the browser | run `curl` requests (or import them into Postman) |
| **Good for** | exploring the data with a few clicks | checking the whole response |
| **What it shows** | HTTP status, the response as cards (flights, hotels, weather, exchange rate) with the full JSON on demand, plus tables of the cities, flights and hotels in the database | raw output of the response |

**Web interface.** Choose the endpoint from the menu, fill in the fields that appear (ID, currency) and press **Show**. The endpoints of the exercises and of the assignment are in the menu: until the method has been written, the page shows a dedicated message. The tables at the bottom of the page (click to open them) show the existing IDs.

**Terminal.** Example request:

```bash
curl -sS 'http://localhost:3000/hotels/1/price?currency=USD'
```

### Changing the code during the exercises

The `nest-backend` folder is mounted in `/app` through a **bind mount**: changing the files with your own editor updates them immediately in the container too, and vice versa. `npm run start:dev` recompiles and restarts the backend when the sources change. Polling lets it detect changes even on the shared file systems of Docker Desktop.

`node_modules` uses a separate volume, so the Linux dependencies of the container are not overwritten by those possibly installed on your computer.

To open a shell in the backend:

```bash
docker compose exec backend sh
```

`Ctrl+C` only stops showing the logs. To stop the environment use `docker compose down`: the MySQL data stays in the `mysql_data` volume. To start again from scratch run `./start-lab.sh` **(This file also deletes data from the backend, so be careful !)**.

## Local API

| Resource | Calls |
| --- | --- |
| City | `GET /cities`, `GET /cities/:id` |
| Flight | `GET /flights`, `GET /flights/:id` |
| Hotel | `GET /hotels`, `GET /hotels/:id` |

The other endpoints (examples, exercises and assignment) are listed in [Examples, exercises and submission](#examples-exercises-and-submission). IDs are positive integers. A non-existent ID produces `404`, an invalid ID (`abc`, `0`) produces `400`. The calls with `?currency=` require a three-letter code: if it is missing or invalid, the response is `400`.

### Database ready for the lab

After executing `start-lab.sh` the project is started and **9 cities, 21 flights and 20 hotels** are prepared.

The cities are Rome, London, New York, Tokyo, Beijing, Toronto, Mexico City, Buenos Aires and Rio De Janeiro, with real coordinates and their currency. Airlines, hotels and prices are for demonstration. The flight times are generated on every run, within the next 48 hours, with the durations given in the dataset: this way every flight is in the future and has a weather forecast available at its arrival.

**Warning:** the command **deletes the existing data** and creates it again from scratch, so the IDs change on every run. Do not assume the IDs are always the same: check them in the tables of the web interface or with `GET /cities`.

### Calling Frankfurter

In `nest-backend/src/service/external.service.ts`, `rate(from, to)` returns the exchange rate from the source currency to the target currency. The `json` helper handles the timeout and the HTTP status; the service validates the answer and returns only the numeric rate, and the controller uses `available` to handle errors.

`GET /rate/:from/:to` (Example 1) exposes the exchange rate between two currencies, for example `/rate/EUR/USD`: the response is `{ "status": "ok", "data": 1.08 }`. The aggregated responses use the same format in the `exchange` section. The Frankfurter rate is updated daily, so it is not a guaranteed price for a future booking.

If Open-Meteo or Frankfurter do not answer within 3 seconds or return an error, the response is still `200` with `status: "unavailable"` in the corresponding section. If the rate is missing, the converted amounts are `null`; the original prices remain available. Local data, instead, must be valid: a non-existent city, flight or hotel produces `404`. The timeout applies to each external call; when the calls do not depend on each other, they start in parallel.

## Suggested schedule (120 minutes, starting at 08:30)

| Time | Activity |
| --- | --- |
| 08:30–08:40 | Review of resources, URIs, methods and HTTP codes from the REST Basics lab |
| 08:40–09:00 | Domain schema; internal and external service; composition, timeout and partial response |
| 09:00–09:25 | Starting the already seeded environment and exploring cities, flights and hotels |
| 09:25–09:35 | Break |
| 09:35–10:05 | Examples (exchange rate, weather at the arrival of a flight) and first exercise (price conversion of a hotel) |
| 10:05–10:25 | Second exercise, assignment, observed errors and a short discussion of the design choices |
| 10:25–10:30 | Submission through the form and wrap-up |

## Examples, exercises and submission

The endpoints are grouped as in the menu of the web interface: **Provided**, **Examples**, **Exercises** and **Assignment**. Requests are tried from the web interface (endpoints not written yet show *Not implemented yet*). The detailed instructions of each example and exercise are in the comments of `nest-backend/src/controller/travel.controller.ts` and `nest-backend/src/service/external.service.ts`.

### Provided

Already working, to explore the data: `GET /cities`, `GET /cities/:id`, `GET /flights`, `GET /flights/:id`, `GET /hotels` and `GET /hotels/:id`.

### Examples

Guided, to be followed step by step with the teacher.

1. **Example 1:** `GET /rate/EUR/:currency`. Call an external service: Frankfurter exchange rate, with timeout and `unavailable` handling.
2. **Example 2:** `GET /flights/:id/weather`. Flight (internal data) and weather of the arrival city at the arrival time (external service), in sequence.

### Exercises

To be written by the students, using the examples as a model.

1. **Exercise 1:** `GET /hotels/:id/price?currency=USD`. Hotel (internal data) and Frankfurter exchange rate: the original price, in the currency of the hotel's city, does not change.
2. **Exercise 2:** `GET /cities/:id/cheapest-trip?currency=USD`. Cheapest flight and hotel of a city, with the total in the requested currency.

### Assignment

`GET /flights/:id/price?currency=USD`. Flight (internal data) and Frankfurter exchange rate: price converted from EUR. The instructions are in [ASSIGNMENT.md](ASSIGNMENT.md).

### Submission

Submit through the form indicated by the teachers **a screenshot or the JSON** of the response of `GET /flights/:id/price?currency=USD`, plus two lines explaining an observed error case. Do not include secrets or `.env` files in the submission.

