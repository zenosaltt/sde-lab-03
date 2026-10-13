// Coordinate reali; compagnie, hotel, prezzi e orari sono dati di esercizio.
export const cities = [
  { name: 'Roma', latitude: 41.9028, longitude: 12.4964 },
  { name: 'Milano', latitude: 45.4642, longitude: 9.19 },
  { name: 'Parigi', latitude: 48.8566, longitude: 2.3522 },
  { name: 'Londra', latitude: 51.5074, longitude: -0.1278 },
  { name: 'Madrid', latitude: 40.4168, longitude: -3.7038 },
  { name: 'Berlino', latitude: 52.52, longitude: 13.405 },
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
type SeedHotel = { city: CityName; name: string; pricePerNightEur: number };

export const flights: SeedFlight[] = [
  { departureCity: 'Roma', arrivalCity: 'Parigi', departureTime: '2026-11-20T09:00:00Z', arrivalTime: '2026-11-20T11:00:00Z', airline: 'Demo Air', priceEur: 120 },
  { departureCity: 'Roma', arrivalCity: 'Parigi', departureTime: '2026-11-20T15:00:00Z', arrivalTime: '2026-11-20T17:10:00Z', airline: 'Lab Wings', priceEur: 85.5 },
  { departureCity: 'Milano', arrivalCity: 'Parigi', departureTime: '2026-11-21T08:00:00Z', arrivalTime: '2026-11-21T09:30:00Z', airline: 'Demo Air', priceEur: 95 },
  { departureCity: 'Parigi', arrivalCity: 'Roma', departureTime: '2026-11-22T10:00:00Z', arrivalTime: '2026-11-22T12:00:00Z', airline: 'Lab Wings', priceEur: 110 },
  { departureCity: 'Londra', arrivalCity: 'Roma', departureTime: '2026-11-23T07:00:00Z', arrivalTime: '2026-11-23T09:40:00Z', airline: 'Tutorial Jet', priceEur: 175.25 },
  { departureCity: 'Madrid', arrivalCity: 'Milano', departureTime: '2026-11-24T12:00:00Z', arrivalTime: '2026-11-24T14:15:00Z', airline: 'Demo Air', priceEur: 130 },
  { departureCity: 'Berlino', arrivalCity: 'Londra', departureTime: '2026-11-25T08:00:00Z', arrivalTime: '2026-11-25T10:00:00Z', airline: 'Lab Wings', priceEur: 99.9 },
  { departureCity: 'Roma', arrivalCity: 'Londra', departureTime: '2026-11-26T11:00:00Z', arrivalTime: '2026-11-26T13:40:00Z', airline: 'Tutorial Jet', priceEur: 155 },
  { departureCity: 'Milano', arrivalCity: 'Madrid', departureTime: '2026-11-27T06:00:00Z', arrivalTime: '2026-11-27T08:20:00Z', airline: 'Demo Air', priceEur: 105.75 },
  { departureCity: 'Berlino', arrivalCity: 'Madrid', departureTime: '2026-11-28T13:00:00Z', arrivalTime: '2026-11-28T16:10:00Z', airline: 'Tutorial Jet', priceEur: 190 },
  { departureCity: 'Parigi', arrivalCity: 'Londra', departureTime: '2026-11-29T17:00:00Z', arrivalTime: '2026-11-29T18:15:00Z', airline: 'Lab Wings', priceEur: 70 },
];

export const hotels: SeedHotel[] = [
  { city: 'Roma', name: 'Demo Hotel Colosseo', pricePerNightEur: 145 },
  { city: 'Roma', name: 'Demo Hotel Trastevere', pricePerNightEur: 95.5 },
  { city: 'Roma', name: 'Demo Hotel Tevere', pricePerNightEur: 65 },
  { city: 'Milano', name: 'Demo Hotel Navigli', pricePerNightEur: 110 },
  { city: 'Milano', name: 'Demo Hotel Duomo', pricePerNightEur: 180 },
  { city: 'Parigi', name: 'Demo Hotel Senna', pricePerNightEur: 90 },
  { city: 'Parigi', name: 'Demo Hotel Montmartre', pricePerNightEur: 125.75 },
  { city: 'Parigi', name: 'Demo Hotel Lumiere', pricePerNightEur: 220 },
  { city: 'Londra', name: 'Demo Hotel Tamigi', pricePerNightEur: 135 },
  { city: 'Londra', name: 'Demo Hotel Camden', pricePerNightEur: 85 },
  { city: 'Londra', name: 'Demo Hotel Westminster', pricePerNightEur: 245.5 },
  { city: 'Berlino', name: 'Demo Hotel Mitte', pricePerNightEur: 80 },
  { city: 'Berlino', name: 'Demo Hotel Spree', pricePerNightEur: 115.25 },
];
