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

export const flights: SeedFlight[] = [
  { departureCity: 'Roma', arrivalCity: 'Parigi', departureTime: '2026-11-20T09:00:00Z', arrivalTime: '2026-11-20T11:00:00Z', airline: 'Demo Air', priceEur: 120 },
  { departureCity: 'Roma', arrivalCity: 'Parigi', departureTime: '2026-11-20T15:00:00Z', arrivalTime: '2026-11-20T17:10:00Z', airline: 'Lab Wings', priceEur: 85.5 },
  { departureCity: 'Milano', arrivalCity: 'Parigi', departureTime: '2026-11-21T08:00:00Z', arrivalTime: '2026-11-21T09:30:00Z', airline: 'Demo Air', priceEur: 95 },
  { departureCity: 'Parigi', arrivalCity: 'Roma', departureTime: '2026-11-22T10:00:00Z', arrivalTime: '2026-11-22T12:00:00Z', airline: 'Lab Wings', priceEur: 110 },
  { departureCity: 'Londra', arrivalCity: 'Roma', departureTime: '2026-11-23T07:00:00Z', arrivalTime: '2026-11-23T09:40:00Z', airline: 'Tutorial Jet', priceEur: 175.25 },
  { departureCity: 'Madrid', arrivalCity: 'Milano', departureTime: '2026-11-24T12:00:00Z', arrivalTime: '2026-11-24T14:15:00Z', airline: 'Demo Air', priceEur: 130 },
  { departureCity: 'Berlino', arrivalCity: 'Londra', departureTime: '2026-11-25T08:00:00Z', arrivalTime: '2026-11-25T10:00:00Z', airline: 'Lab Wings', priceEur: 99.9 },
  { departureCity: 'Roma', arrivalCity: 'Londra', departureTime: '2026-11-26T11:00:00Z', arrivalTime: '2026-11-26T13:40:00Z', airline: 'Tutorial Jet', priceEur: 155 },
  { departureCity: 'Milano', arrivalCity: 'Madrid', departureTime: '2026-01-27T06:00:00Z', arrivalTime: '2026-10-25T08:20:00Z', airline: 'Demo Air', priceEur: 105.75 },
  { departureCity: 'Berlino', arrivalCity: 'Madrid', departureTime: '2026-01-28T13:00:00Z', arrivalTime: '2026-10-24T16:10:00Z', airline: 'Tutorial Jet', priceEur: 190 },
  { departureCity: 'Parigi', arrivalCity: 'Londra', departureTime: '2026-01-29T17:00:00Z', arrivalTime: '2026-10-23T18:15:00Z', airline: 'Lab Wings', priceEur: 70 },
  { departureCity: 'Roma', arrivalCity: 'New York', departureTime: '2026-12-01T10:00:00Z', arrivalTime: '2026-12-01T18:30:00Z', airline: 'Demo Air', priceEur: 540 },
  { departureCity: 'Londra', arrivalCity: 'New York', departureTime: '2026-12-02T09:00:00Z', arrivalTime: '2026-12-02T17:00:00Z', airline: 'Tutorial Jet', priceEur: 480.5 },
  { departureCity: 'Parigi', arrivalCity: 'Tokyo', departureTime: '2026-12-03T11:00:00Z', arrivalTime: '2026-12-04T05:30:00Z', airline: 'Lab Wings', priceEur: 910 },
  { departureCity: 'Berlino', arrivalCity: 'Tokyo', departureTime: '2026-12-05T13:00:00Z', arrivalTime: '2026-12-06T07:45:00Z', airline: 'Demo Air', priceEur: 875.9 },
  { departureCity: 'New York', arrivalCity: 'Roma', departureTime: '2026-12-10T22:00:00Z', arrivalTime: '2026-12-11T10:00:00Z', airline: 'Tutorial Jet', priceEur: 520 },
];

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
