import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from "@nestjs/common";
import { TravelService } from "../service/travel.service.ts";
import { ExternalService } from "../service/external.service.ts";

// Currency used when the client does not send ?currency=
const DEFAULT_CURRENCY = "EUR";

// Result of a call that may fail: either { status: 'ok', data: ... } or
// { status: 'unavailable' }. The "|" means "one or the other"; <T> is the type
// of the data (e.g. the weather object or the exchange rate number).
type Available<T> = { status: "ok"; data: T } | { status: "unavailable" };

// Waits for a promise (e.g. an external API call) and NEVER throws.
// - success -> { status: 'ok', data: <result> }
// - failure (timeout, HTTP error, invalid response) -> { status: 'unavailable' }
// This is what lets the endpoints answer 200 even if Open-Meteo or Frankfurter is down.
async function available<T>(promise: Promise<T>): Promise<Available<T>> {
  try {
    // "await" pauses here until the promise finishes; if it fails it jumps to catch.
    return { status: "ok", data: await promise };
  } catch {
    // We ignore the error details: the client only needs to know it is unavailable.
    return { status: "unavailable" };
  }
}

// Checks that the body of a POST is a JSON object like {"a": 1}.
// typeof null is "object" in JavaScript and arrays are objects too, so both
// are excluded explicitly. Otherwise -> 400.
function requireJsonObject(body: unknown): Record<string, unknown> {
  const isPlainObject =
    typeof body === "object" && body !== null && !Array.isArray(body);
  if (!isPlainObject) {
    throw new BadRequestException("JSON object required");
  }
  return body as Record<string, unknown>;
}

// IDs in the database start from 1. ParseIntPipe already guarantees that the
// value is an integer; this function rejects 0 and negative numbers with 400.
function requirePositiveId(id: number): number {
  if (id < 1) {
    throw new BadRequestException("ID must be positive");
  }
  return id;
}

// Reads the currency from the query string (?currency=usd).
// - missing -> default currency (EUR)
// - present -> converted to upper case and checked: exactly three letters, else 400
function parseCurrency(requested: unknown): string {
  if (requested === undefined) {
    return DEFAULT_CURRENCY;
  }
  // If it is not a string (e.g. ?currency=a&currency=b gives an array) we use ''
  // so that the check below fails and the request is rejected.
  const currency = typeof requested === "string" ? requested.toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BadRequestException("currency must be a three-letter code");
  }
  return currency;
}

// Converts a price in EUR using the exchange rate.
// - rate === null means the exchange service was unavailable: we return null
//   (the client sees that the converted price is missing; the EUR price remains).
// - otherwise price * rate, rounded to 2 decimals (multiply by 100, round, divide by 100).
function convertPrice(priceEur: number, rate: number | null): number | null {
  if (rate === null) {
    return null;
  }
  // Number(...) makes sure we are multiplying numbers, not strings.
  return Math.round(Number(priceEur) * rate * 100) / 100;
}

// Helper per il cambio valuta: come ExternalService, ogni richiesta esterna
// ha un timeout di 3 secondi e controlla HTTP prima di leggere il JSON.
// I chiamanti devono validare i dati: il provider non è una fonte tipizzata.
async function externalJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.json();
}

// Frankfurter: https://frankfurter.dev/ — cambio da EUR alla valuta richiesta.
// Il tasso è quello più recente pubblicato, non un prezzo di prenotazione futuro.
async function rateFromEur(currency: string): Promise<number> {
  if (currency === DEFAULT_CURRENCY) return 1;
  const baseUrl =
    process.env.TRAVEL_EXCHANGE_BASE_URL ?? "https://api.frankfurter.dev";
  const url = new URL(`${baseUrl}/v2/rate/EUR/${currency}`);
  const data = (await externalJson(url)) as { rate?: unknown } | null;
  if (
    typeof data?.rate !== "number" ||
    !Number.isFinite(data.rate) ||
    data.rate <= 0
  ) {
    throw new Error("Invalid exchange rate response");
  }
  return data.rate;
}

// I prezzi persistiti hanno due decimali: sommarli in centesimi evita risultati
// come 0.1 + 0.2 = 0.30000000000000004 nella business logic.
function cents(price: number): number {
  return Math.round(Number(price) * 100);
}

// @Controller() marks the class as a set of HTTP routes. No prefix is given,
// so each route below uses its full path (e.g. /cities).
// Il controller legge i parametri e compone la risposta. Il database resta in
// TravelService; il meteo passa da ExternalService e il cambio dell'esempio
// hotel usa l'helper sopra finché ExternalService.rate resta un TODO.
@Controller()
export class TravelController {
  // NestJS creates the two services and passes them here (dependency injection).
  // "private readonly" also creates the fields this.travel and this.external.
  constructor(
    private readonly travel: TravelService,
    private readonly external: ExternalService,
  ) {}

  // Cities
  // GET /cities -> list of all cities.
  @Get("cities")
  getCities() {
    return this.travel.allCities();
  }

  // GET /cities/3 -> one city. ":id" is a path parameter.
  // ParseIntPipe converts "3" into the number 3 (and answers 400 for "abc").
  // requirePositiveId rejects 0 or negatives (400); the service answers 404 if the city does not exist.
  @Get("cities/:id")
  getCity(@Param("id", ParseIntPipe) id: number) {
    return this.travel.city(requirePositiveId(id));
  }

  // Flights

  // GET /flights -> all flights, with departure and arrival city.
  @Get("flights")
  getFlights() {
    return this.travel.allFlights();
  }

  // GET /flights/:id -> one flight (400 for an invalid ID, 404 if it does not exist).
  @Get("flights/:id")
  getFlight(@Param("id", ParseIntPipe) id: number) {
    return this.travel.flight(requirePositiveId(id));
  }

  // Hotels

  // GET /hotels -> all hotels, each with its city.
  @Get("hotels")
  getHotels() {
    return this.travel.allHotels();
  }

  // GET /hotels/:id -> one hotel (400 invalid ID, 404 not found).
  @Get("hotels/:id")
  getHotel(@Param("id", ParseIntPipe) id: number) {
    return this.travel.hotel(requirePositiveId(id));
  }

  // External exchange rate

  // GET /rate/EUR/USD -> exchange rate between two currencies, taken directly
  // from Frankfurter. No database is involved.
  @Get("rate/:from/:to")
  async getRate(@Param("from") from: string, @Param("to") to: string) {
    // Validate both codes (three letters, upper case); invalid -> 400.
    from = parseCurrency(from);
    to = parseCurrency(to);
    // available(...) turns an external failure into { status: 'unavailable' }
    // instead of an error, so the answer is still 200.
    return await available(this.external.rate(from, to));
  }

  // ---------------------------------------------------------------------------
  // SOLUZIONE PROPOSTA 1 — esempio guidato: volo + meteo all'arrivo.
  // GET /flights/1/weather
  // Composizione sequenziale: prima il dato interno, poi la richiesta esterna
  // costruita con coordinate della destinazione e orario di arrivo del volo.
  // 400: ID non valido; 404: volo assente; 200: volo con meteo o unavailable.
  // ---------------------------------------------------------------------------
  @Get("flights/:id/weather")
  async getFlightWeather(@Param("id", ParseIntPipe) id: number) {
    // 1. Il servizio carica il volo con arrivalCity; non serve una seconda query
    //    per ricavare le coordinate della destinazione.
    const flight = await this.travel.flight(requirePositiveId(id));

    // 2. Passiamo arrivalTime al terzo parametro opzionale di ExternalService.weather.
    //    Senza data lo stesso metodo continua a restituire il meteo corrente.
    // 3. available intercetta timeout, risposte invalide e date fuori previsione:
    //    il volo resta consultabile anche quando manca il meteo.
    const weather = await available(
      this.external.weather(
        flight.arrivalCity.latitude,
        flight.arrivalCity.longitude,
        flight.arrivalTime,
      ),
    );

    // 4. I dati interni restano distinti dal risultato della composizione esterna.
    //    weather.data.time indica l'inizio dell'ora UTC che contiene l'arrivo:
    //    per esempio, arrivo alle 17:10Z -> previsione delle 17:00Z.
    return { flight, weather };
  }

  // ---------------------------------------------------------------------------
  // SOLUZIONE PROPOSTA 2 — hotel + cambio valuta.
  // GET /hotels/1/price?currency=USD; senza currency si usa EUR.
  // Tutti i prezzi nel database sono già in EURO, anche per città non europee:
  // city.currency NON è la valuta di partenza del prezzo dell'hotel.
  // Come nel primo esempio: dato interno -> API esterna -> risposta composta.
  // ---------------------------------------------------------------------------
  @Get("hotels/:id/price")
  async getHotelPrice(
    @Param("id", ParseIntPipe) id: number,
    @Query("currency") requestedCurrency?: string,
  ) {
    // Validare l'input prima di contattare il database o un provider esterno.
    const currency = parseCurrency(requestedCurrency);
    const hotel = await this.travel.hotel(requirePositiveId(id));

    // EUR -> EUR vale sempre 1: non dipende dalla disponibilità di Frankfurter.
    // rateFromEur esegue qui la chiamata perché ExternalService.rate è ancora
    // un TODO del laboratorio; il meteo invece riutilizza ExternalService.weather.
    const exchange = await available(rateFromEur(currency));
    const rate = exchange.status === "ok" ? exchange.data : null;

    // Non sovrascrivere il prezzo originale nell'entità né nel database.
    // Se il cambio fallisce: HTTP 200, pricePerNight null, importo EUR disponibile.
    return {
      hotel,
      pricePerNightEur: hotel.pricePerNight,
      currency,
      exchange,
      pricePerNight: convertPrice(hotel.pricePerNight, rate),
    };
  }

  // ---------------------------------------------------------------------------
  // SOLUZIONE PROPOSTA 3 — business logic: volo + hotel più economici.
  // GET /cities/3/cheapest-trip
  // Contratto del laboratorio: un volo di andata da qualsiasi origine + UNA notte
  // in hotel, entrambi per la città richiesta, totale in EUR. Non è una verifica
  // di disponibilità: il modello non contiene camere, check-in o prenotazioni.
  // 404 se la città non esiste oppure manca una delle due componenti.
  // ---------------------------------------------------------------------------
  @Get("cities/:id/cheapest-trip")
  async getCheapestTrip(@Param("id", ParseIntPipe) id: number) {
    const city = await this.travel.city(requirePositiveId(id));

    // Le due letture interne sono indipendenti: possono partire in parallelo.
    // Un errore del database si propaga: available è riservato ai dati esterni.
    const [flights, hotels] = await Promise.all([
      this.travel.flightsTo(city.id),
      this.travel.hotelsIn(city.id),
    ]);
    if (flights.length === 0 || hotels.length === 0) {
      throw new NotFoundException("No flight-hotel combination for this city");
    }

    // Ogni volo è combinabile con ogni hotel della stessa destinazione e non ci
    // sono sconti di pacchetto: min(volo + hotel) = min(volo) + min(hotel).
    // Bastano due scansioni, O(voli + hotel), senza costruire tutte le coppie.
    // Confrontiamo centesimi interi; a parità di prezzo scegliamo l'ID minore
    // per ottenere lo stesso risultato indipendentemente dall'ordine delle query.
    const flight = flights.reduce((best, candidate) => {
      const difference = cents(candidate.priceEur) - cents(best.priceEur);
      return difference < 0 || (difference === 0 && candidate.id < best.id)
        ? candidate
        : best;
    });
    const hotel = hotels.reduce((best, candidate) => {
      const difference =
        cents(candidate.pricePerNight) - cents(best.pricePerNight);
      return difference < 0 || (difference === 0 && candidate.id < best.id)
        ? candidate
        : best;
    });

    return {
      city,
      flight,
      hotel,
      nights: 1,
      currency: DEFAULT_CURRENCY,
      totalPriceEur:
        (cents(flight.priceEur) + cents(hotel.pricePerNight)) / 100,
    };
  }
  
  //@Get("flights/:id/price")
  //async getFlightPrice( @Param("id", ParseIntPipe) id: number,@Query("currency") requestedCurrency?: string) {
    
  //}
}
