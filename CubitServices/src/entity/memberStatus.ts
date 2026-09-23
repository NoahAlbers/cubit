import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

//see https://typeorm.io/#/entities/ for how entities work
@Entity()
export class Status {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options
  @Column()
  status: string;
}
