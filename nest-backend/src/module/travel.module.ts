import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../model/city.entity.ts';
import { Flight } from '../model/flight.entity.ts';
import { Hotel } from '../model/hotel.entity.ts';
import { TravelController } from '../controller/travel.controller.ts';
import { TravelService } from '../service/travel.service.ts';
import { ExternalService } from '../service/external.service.ts';

@Module({
  imports: [TypeOrmModule.forFeature([City, Flight, Hotel])],
  controllers: [TravelController],
  providers: [TravelService, ExternalService],
})
export class TravelModule {}
