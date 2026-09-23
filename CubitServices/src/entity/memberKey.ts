import { Guid } from 'guid-typescript'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm'
import { Member } from './member'

//see https://typeorm.io/#/entities/ for how entities work
@Entity({ name: 'memberKey' })
export class MemberKey {
  @PrimaryColumn({ type: String, default: Guid.create().toString() })
  id: string

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options
  @Column()
  serialNumber: string

  @Column()
  memberId: string

  @ManyToOne(() => Member)
  member: Member

  @Column({ nullable: true })
  status: string
}
