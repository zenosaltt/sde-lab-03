// Coordinate reali; compagnie, hotel, prezzi e orari sono dati di esercizio.
export const cities = [
  { name: 'Roma', latitude: 41.9028, longitude: 12.4964, currency: 'EUR' },
  { name: 'Milano', latitude: 45.4642, longitude: 9.19, currency: 'EUR' },
  { name: 'Parigi', latitude: 48.8566, longitude: 2.3522, currency: 'EUR' },
  { name: 'Londra', latitude: 51.5074, longitude: -0.1278, currency: 'GBP' },
  { name: 'Madrid', latitude: 40.4168, longitude: -3.7038, currency: 'EUR' },
  { name: 'Berlino', latitude: 52.52, longitude: 13.405, currency: 'EUR' },
  { name: 'New York', latitude: 40.7128, longitude: -74.006, currency: 'USD' },
  { name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, currency: 'JPY' },
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
  { departureCity: 'Roma', arrivalCity: 'Parigi', airline: 'Demo Air', priceEur: 120, durationMinutes: 120 },
  { departureCity: 'Roma', arrivalCity: 'Parigi', airline: 'Lab Wings', priceEur: 85.5, durationMinutes: 130 },
  { departureCity: 'Milano', arrivalCity: 'Parigi', airline: 'Demo Air', priceEur: 95, durationMinutes: 90 },
  { departureCity: 'Parigi', arrivalCity: 'Roma', airline: 'Lab Wings', priceEur: 110, durationMinutes: 120 },
  { departureCity: 'Londra', arrivalCity: 'Roma', airline: 'Tutorial Jet', priceEur: 175.25, durationMinutes: 160 },
  { departureCity: 'Madrid', arrivalCity: 'Milano', airline: 'Demo Air', priceEur: 130, durationMinutes: 135 },
  { departureCity: 'Berlino', arrivalCity: 'Londra', airline: 'Lab Wings', priceEur: 99.9, durationMinutes: 120 },
  { departureCity: 'Roma', arrivalCity: 'Londra', airline: 'Tutorial Jet', priceEur: 155, durationMinutes: 160 },
  { departureCity: 'Milano', arrivalCity: 'Madrid', airline: 'Demo Air', priceEur: 105.75, durationMinutes: 140 },
  { departureCity: 'Berlino', arrivalCity: 'Madrid', airline: 'Tutorial Jet', priceEur: 190, durationMinutes: 190 },
  { departureCity: 'Parigi', arrivalCity: 'Londra', airline: 'Lab Wings', priceEur: 70, durationMinutes: 75 },
  { departureCity: 'Roma', arrivalCity: 'New York', airline: 'Demo Air', priceEur: 540, durationMinutes: 510 },
  { departureCity: 'Londra', arrivalCity: 'New York', airline: 'Tutorial Jet', priceEur: 480.5, durationMinutes: 480 },
  { departureCity: 'Parigi', arrivalCity: 'Tokyo', airline: 'Lab Wings', priceEur: 910, durationMinutes: 1110 },
  { departureCity: 'Berlino', arrivalCity: 'Tokyo', airline: 'Demo Air', priceEur: 875.9, durationMinutes: 1125 },
  { departureCity: 'New York', arrivalCity: 'Roma', airline: 'Tutorial Jet', priceEur: 520, durationMinutes: 720 },
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
  { city: 'Roma', name: 'Demo Hotel Colosseo', pricePerNight: 145 },
  { city: 'Roma', name: 'Demo Hotel Trastevere', pricePerNight: 95.5 },
  { city: 'Roma', name: 'Demo Hotel Tevere', pricePerNight: 65 },
  { city: 'Milano', name: 'Demo Hotel Navigli', pricePerNight: 110 },
  { city: 'Milano', name: 'Demo Hotel Duomo', pricePerNight: 180 },
  { city: 'Parigi', name: 'Demo Hotel Senna', pricePerNight: 90 },
  { city: 'Parigi', name: 'Demo Hotel Montmartre', pricePerNight: 125.75 },
  { city: 'Parigi', name: 'Demo Hotel Lumiere', pricePerNight: 220 },
  { city: 'Londra', name: 'Demo Hotel Tamigi', pricePerNight: 135 },
  { city: 'Londra', name: 'Demo Hotel Camden', pricePerNight: 85 },
  { city: 'Londra', name: 'Demo Hotel Westminster', pricePerNight: 245.5 },
  { city: 'Berlino', name: 'Demo Hotel Mitte', pricePerNight: 80 },
  { city: 'Berlino', name: 'Demo Hotel Spree', pricePerNight: 115.25 },
  { city: 'New York', name: 'Demo Hotel Manhattan', pricePerNight: 280 },
  { city: 'New York', name: 'Demo Hotel Brooklyn', pricePerNight: 165.5 },
  { city: 'Tokyo', name: 'Demo Hotel Shinjuku', pricePerNight: 150 },
  { city: 'Tokyo', name: 'Demo Hotel Asakusa', pricePerNight: 95.75 },
  { city: 'Madrid', name: 'Grand Hotel Madrid', pricePerNight: 95.75 },
];
