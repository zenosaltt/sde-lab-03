import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './city.entity.js';
import { Flight } from './flight.entity.js';
import { Hotel } from './hotel.entity.js';
import { TravelController } from './travel.controller.js';
import { TravelService } from './travel.service.js';
import { ExternalService } from './external.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([City, Flight, Hotel])],
  controllers: [TravelController],
  providers: [TravelService, ExternalService],
})
export class TravelModule {}
