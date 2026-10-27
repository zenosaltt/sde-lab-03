// Coordinate reali; compagnie, hotel, prezzi e orari sono dati di esercizio.
export const cities = [
  { name: 'Rome', latitude: 41.9028, longitude: 12.4964, currency: 'EUR' },
  { name: 'London', latitude: 51.5074, longitude: -0.1278, currency: 'GBP' },
  { name: 'New York', latitude: 40.7128, longitude: -74.006, currency: 'USD' },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, currency: 'JPY' },
  { name: 'Beijing', latitude: 39.9042, longitude: 116.4073, currency: 'CNY' },
  { name: 'Toronto', latitude: 43.6532, longitude: -79.3831, currency: 'CAD' },
  { name: 'Mexico City', latitude: 19.4326, longitude: -99.1332, currency: 'MXN' },
  { name: 'Buenos Aires', latitude: -34.6036, longitude: -58.381557, currency: 'ARS' },
  { name: 'Rio De Janeiro', latitude: -22.906847, longitude: -43.172897, currency: 'BRL' },
] as const;

type CityName = typeof cities[number]['name'];
type SeedFlight = {
  departureCity: CityName;
  arrivalCity: CityName;
  departureTime: string;
  arrivalTime: string;
  airline: string;
  priceEur: number;
};
type SeedHotel = { city: CityName; name: string; pricePerNight: number };


const WINDOW_MS = 48 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type FlightTemplate = Omit<SeedFlight, 'departureTime' | 'arrivalTime'> & {
  durationMinutes: number;
};

const templates: FlightTemplate[] = [
  // Europa <-> resto del mondo
  { departureCity: 'Rome', arrivalCity: 'London', airline: 'Tutorial Jet', priceEur: 155, durationMinutes: 160 },
  { departureCity: 'London', arrivalCity: 'Rome', airline: 'Tutorial Jet', priceEur: 175.25, durationMinutes: 160 },
  { departureCity: 'Rome', arrivalCity: 'New York', airline: 'Demo Air', priceEur: 540, durationMinutes: 510 },
  { departureCity: 'New York', arrivalCity: 'Rome', airline: 'Tutorial Jet', priceEur: 520, durationMinutes: 720 },
  { departureCity: 'London', arrivalCity: 'New York', airline: 'Tutorial Jet', priceEur: 480.5, durationMinutes: 480 },
  { departureCity: 'Rome', arrivalCity: 'Tokyo', airline: 'Lab Wings', priceEur: 880, durationMinutes: 780 },
  { departureCity: 'London', arrivalCity: 'Beijing', airline: 'Demo Air', priceEur: 690.9, durationMinutes: 600 },
  { departureCity: 'Beijing', arrivalCity: 'Rome', airline: 'Lab Wings', priceEur: 780, durationMinutes: 640 },
  { departureCity: 'Rome', arrivalCity: 'Rio De Janeiro', airline: 'Demo Air', priceEur: 720, durationMinutes: 710 },
  { departureCity: 'Rio De Janeiro', arrivalCity: 'London', airline: 'Tutorial Jet', priceEur: 760.5, durationMinutes: 700 },
  { departureCity: 'Toronto', arrivalCity: 'London', airline: 'Lab Wings', priceEur: 520, durationMinutes: 420 },

  // Nord America
  { departureCity: 'New York', arrivalCity: 'Toronto', airline: 'Demo Air', priceEur: 140, durationMinutes: 95 },
  { departureCity: 'Toronto', arrivalCity: 'New York', airline: 'Lab Wings', priceEur: 135.75, durationMinutes: 90 },
  { departureCity: 'New York', arrivalCity: 'Mexico City', airline: 'Tutorial Jet', priceEur: 260, durationMinutes: 270 },
  { departureCity: 'Mexico City', arrivalCity: 'Toronto', airline: 'Demo Air', priceEur: 310, durationMinutes: 300 },

  // Asia
  { departureCity: 'Tokyo', arrivalCity: 'Beijing', airline: 'Lab Wings', priceEur: 320, durationMinutes: 240 },
  { departureCity: 'Beijing', arrivalCity: 'Tokyo', airline: 'Demo Air', priceEur: 295.5, durationMinutes: 225 },
  { departureCity: 'Tokyo', arrivalCity: 'New York', airline: 'Tutorial Jet', priceEur: 950, durationMinutes: 800 },

  // Sud America
  { departureCity: 'Mexico City', arrivalCity: 'Buenos Aires', airline: 'Lab Wings', priceEur: 640, durationMinutes: 530 },
  { departureCity: 'Buenos Aires', arrivalCity: 'Rio De Janeiro', airline: 'Demo Air', priceEur: 210, durationMinutes: 175 },
  { departureCity: 'Rio De Janeiro', arrivalCity: 'Buenos Aires', airline: 'Tutorial Jet', priceEur: 205.9, durationMinutes: 195 },
];

/**
 * Returns the seed flights. Every flight departs at a random moment and
 * arrives (after its fixed duration) before the end of the next 48 hours.
 */
export function getFlights(): SeedFlight[] {
  const now: Date = new Date()
  const start = now.getTime();

  return templates.map(({ durationMinutes, ...flight }) => {
    const durationMs = durationMinutes * MINUTE_MS;
    // Latest possible departure so that arrival still falls inside the window.
    const maxDepartureOffset = Math.max(0, WINDOW_MS - durationMs);
    const departure = start + Math.random() * maxDepartureOffset;
    const arrival = departure + durationMs;

    return {
      ...flight,
      departureTime: new Date(departure).toISOString(),
      arrivalTime: new Date(arrival).toISOString(),
    };
  });
}

export const hotels: SeedHotel[] = [
  { city: 'Rome', name: 'Demo Hotel Colosseo', pricePerNight: 145 },
  { city: 'Rome', name: 'Demo Hotel Trastevere', pricePerNight: 95.5 },
  { city: 'Rome', name: 'Demo Hotel Tevere', pricePerNight: 65 },
  { city: 'London', name: 'Demo Hotel Tamigi', pricePerNight: 135 },
  { city: 'London', name: 'Demo Hotel Camden', pricePerNight: 85 },
  { city: 'London', name: 'Demo Hotel Westminster', pricePerNight: 245.5 },
  { city: 'New York', name: 'Demo Hotel Manhattan', pricePerNight: 280 },
  { city: 'New York', name: 'Demo Hotel Brooklyn', pricePerNight: 165.5 },
  { city: 'Tokyo', name: 'Demo Hotel Shinjuku', pricePerNight: 150 },
  { city: 'Tokyo', name: 'Demo Hotel Asakusa', pricePerNight: 95.75 },
  { city: 'Beijing', name: 'Demo Hotel Hutong', pricePerNight: 70 },
  { city: 'Beijing', name: 'Demo Hotel Citta Proibita', pricePerNight: 135.5 },
  { city: 'Toronto', name: 'Demo Hotel Lakeshore', pricePerNight: 120 },
  { city: 'Toronto', name: 'Demo Hotel Distillery', pricePerNight: 90.25 },
  { city: 'Mexico City', name: 'Demo Hotel Zocalo', pricePerNight: 60 },
  { city: 'Mexico City', name: 'Demo Hotel Polanco', pricePerNight: 130.75 },
  { city: 'Buenos Aires', name: 'Demo Hotel Palermo', pricePerNight: 75 },
  { city: 'Buenos Aires', name: 'Demo Hotel Recoleta', pricePerNight: 110.5 },
  { city: 'Rio De Janeiro', name: 'Demo Hotel Copacabana', pricePerNight: 105 },
  { city: 'Rio De Janeiro', name: 'Demo Hotel Ipanema', pricePerNight: 140.25 },
];