import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { City } from './city.entity.js';

@Entity('flights')
export class Flight {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => City, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'departureCityId' })
  departureCity: City;

  @ManyToOne(() => City, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'arrivalCityId' })
  arrivalCity: City;

  @Column({ type: 'datetime' })
  departureTime: Date;

  @Column({ type: 'datetime' })
  arrivalTime: Date;

  @Column({ length: 100 })
  airline: string;

  @Column('decimal', {
    precision: 10, scale: 2,
    transformer: { to: (value: number) => value, from: (value: string) => Number(value) },
  })
  priceEur: number;
}
