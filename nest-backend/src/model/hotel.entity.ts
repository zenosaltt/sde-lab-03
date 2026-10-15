import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { City } from './city.entity.ts';

@Entity('hotels')
export class Hotel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column('decimal', {
    precision: 10, scale: 2,
    transformer: { to: (value: number) => value, from: (value: string) => Number(value) },
  })
  pricePerNight: number;

  @ManyToOne(() => City, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cityId' })
  city: City;
}
