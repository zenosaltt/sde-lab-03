import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('cities')
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column('double')
  latitude: number;

  @Column('double')
  longitude: number;

  @Column({length: 3})
  currency: string
}
