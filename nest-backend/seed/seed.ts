import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.ts';
import { TravelService } from '../src/service/travel.service.ts';
import { runSeed } from './run-seed.ts';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
    abortOnError: false,
  });
  try {
    const { added, cityIds } = await runSeed(app.get(TravelService));
    console.log(`Seed completato. Aggiunti: ${added.cities} città, ${added.flights} voli, ${added.hotels} hotel.`);
    console.table([...cityIds].map(([city, id]) => ({ city, id })));
    const baseUrl = `http://localhost:${process.env.PORT ?? 3000}`;
    for (const name of ['Parigi', 'Madrid', 'Berlino']) {
      console.log(`${name}: ${baseUrl}/cities/${cityIds.get(name)}/travel-options?currency=USD`);
    }
  } finally {
    await app.close();
  }
}

try {
  await seed();
} catch (error) {
  console.error('Seed non riuscito:', error);
  process.exitCode = 1;
}
