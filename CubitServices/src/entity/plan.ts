import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

//see https://typeorm.io/#/entities/ for how entities work
@Entity()
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options
  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthlyCost: number;

  @Column({ default: true })
  available: boolean;

  @Column({ default: 1 })
  revision: number;
}
