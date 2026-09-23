import { AppDataSource } from '../app'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Timestamp,
  ManyToOne,
  Between,
  MoreThanOrEqual,
} from 'typeorm'
import { Member } from './member'
import dayjs from 'dayjs'

//see https://typeorm.io/#/entities/ for how entities work
@Entity()
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options
  @ManyToOne(() => Member)
  sponsorMember: Member

  @ManyToOne(() => Member)
  assigneeMember: Member

  @Column({ nullable: false })
  title: string

  @Column({ nullable: true, type: 'int' })
  timeEstimateHours: number

  @Column({ nullable: true, length: 4000 })
  description: string

  @Column({ nullable: true })
  dueDate: Date

  @Column({
    update: false,
    default: () => 'NOW()',
  })
  timestamp: Date
}
