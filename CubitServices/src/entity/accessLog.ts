import { AppDataSource } from '../database'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Between,
  MoreThanOrEqual,
} from 'typeorm'
import { Member } from './member'
import dayjs from 'dayjs'

//see https://typeorm.io/#/entities/ for how entities work
@Entity()
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options
  @ManyToOne(() => Member)
  member: Member

  @Column({ nullable: true })
  message: string

  @Column({ nullable: true })
  accessGranted: boolean

  // Keep the key ID even if that key is later removed. Legacy logs have no key ID.
  @Column({ type: 'varchar', length: 36, nullable: true })
  memberKeyId: string | null

  @Column({
    update: false,
    default: () => 'NOW()',
  })
  timestamp: Date

  public static postAccessLog(
    member: Member | null,
    message: string,
    accessGranted: boolean = false,
    memberKeyId: string | null = null
  ) {
    const log = new AccessLog()
    if (member) {
      log.member = member
    }

    log.message = message
    log.memberKeyId = memberKeyId

    if (accessGranted != null) {
      log.accessGranted = accessGranted
    }

    AppDataSource.manager.insert(AccessLog, log).then((res) => {
      return
    })
  }

  public static getAccessLog(days: number = 30, member: string = '') {
    let today = dayjs()
    let start = today.subtract(days, 'day').toDate()

    return (
      AppDataSource.manager
        .createQueryBuilder(AccessLog, 'accessLog')
        .leftJoinAndSelect('accessLog.member', 'member')
        // .addSelect("member.lastName", "lastName")
        // .addSelect("member.email", "email")
        // .addSelect("member.status", "memberStatus")
        // .addSelect("accessGranted")
        // .addSelect("message")
        .select([
          'accessLog.id',
          'accessLog.timestamp',
          'member.firstName',
          'member.lastName',
          'member.email',
          'member.status',
          'member.id',
          'accessLog.accessGranted',
          'accessLog.message',
        ])
        .where('accessLog.member IS NOT NULL')
        .andWhere({
          timestamp: MoreThanOrEqual(start),
        })
        .orderBy('timestamp', 'DESC')
        .addOrderBy('accessLog.id', 'ASC')
        .getMany()
    )
  }
}
