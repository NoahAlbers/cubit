import { hash, compare } from 'bcrypt'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Raw,
  ManyToMany,
} from 'typeorm'
import { AccessLog } from './accessLog'
import { MemberKey } from './memberKey'
import { MemberPlan } from './memberPlan'
import { Plan } from './plan'
import { Transaction } from './transaction'
import { AppDataSource } from '../database'
import { billingLedger, membershipStatus, day } from '../billing/ledger'
import { ensureBilling } from '../billing/store'

// Fixed cost-12 hash of a discarded random password. Missing/unprovisioned
// accounts must still perform password work rather than expose their existence.
const DUMMY_PASSWORD_HASH = '$2b$12$etWikrT3xEJPL7DXZ..CDuATVnJVB83CY7WMf64hktKUa/B.E7xWe'

export enum ROLES {
  MEMBER = 'member',
  ADMIN = 'admin',
}

@Entity()
export class Member {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ default: false }) accessHold: boolean
  @Column({ default: '' }) accessHoldReason: string
  @Column({ default: false }) billingSuspended: boolean

  @Column()
  firstName: string

  @Column()
  lastName: string

  @Column({ nullable: false })
  email: string

  @Column({ nullable: false })
  paypalEmail: string

  @Column({ nullable: true })
  emergencyContact: string

  @Column({ nullable: true })
  emergencyEmail: string

  @Column({ nullable: true })
  emergencyPhone: string

  @Column({ default: 'Not Set' })
  password: string

  @Column({ type: 'int', unsigned: true, default: 0 })
  tokenVersion: number = 0

  @Column({ default: false })
  loginDisabled: boolean = false

  @Column({ nullable: true })
  phone: string

  @Column({ nullable: true })
  picture: string

  @Column({ nullable: true })
  status: string

  @Column({ nullable: true })
  statusReason: string

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  balance: number

  @Column({ nullable: true })
  role: ROLES

  @OneToMany(() => AccessLog, (accessLog) => accessLog.member)
  accessLog: AccessLog[]

  @OneToMany(() => MemberPlan, (plan) => plan.member)
  plans: Plan[]

  @OneToMany(() => Transaction, (transaction) => transaction.member)
  transactions: Transaction[]

  @OneToMany(() => MemberKey, (key) => key.member)
  keys: MemberKey[]

  public async checkForDuplicateEmail(email: string): Promise<boolean> {
    let [members, count] = await AppDataSource.manager.findAndCountBy(Member, {
      email: email,
    })
    return Promise.resolve(count > 0)
  }

  public async GetMemberByEmailAndPass(
    email: string,
    password: string
  ): Promise<Member> {
    const started = performance.now()
    // Imported records can collide after normalization. Never choose an arbitrary
    // identity, even when one of the records has a matching password.
    const matchesByEmail = await AppDataSource.manager.find(Member, {
      where: { email: Raw(alias => `LOWER(REGEXP_REPLACE(${alias}, '^[[:space:]]+|[[:space:]]+$', '')) = :loginEmail`, { loginEmail: email.trim().toLowerCase() }) }, take: 2,
    })
    const member = matchesByEmail.length === 1 ? matchesByEmail[0] : null
    const hasPassword = !!member && !member.loginDisabled && /^\$2[aby]\$\d{2}\$/.test(member.password || '')
    const matches = await compare(password, hasPassword ? member!.password : DUMMY_PASSWORD_HASH)
    // Imported accounts have different bcrypt costs. Equalize ordinary failures
    // as well as running bcrypt; the request limiter bounds this extra work.
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 400 - (performance.now() - started))))
    if (!member || !hasPassword || !matches) throw new Error('Invalid email or password')
    return member
  }
  public async GetMemberByEmail(email: string): Promise<Member> {
    return AppDataSource.manager.findOneByOrFail(Member, { email: email }).then(
      (member) => {
        return member
      },
      (err) => {
        return err
      }
    )
  }

  public async GetMemberByPaypalEmail(email: string): Promise<Member> {
    return AppDataSource.manager
      .findOneByOrFail(Member, { paypalEmail: email })
      .then(
        async (member) => {
          console.log('found member:', member.firstName, member.lastName)
          return member
        },
        (err) => {
          console.log('email not found:', email)
          return err
        }
      )
  }

  public async getBilling(memberId: string) {
    return ensureBilling(memberId)
  }

  public async isMemberActive(memberId: string) {
    const { status } = await this.getBilling(memberId)
    return status === 'Active'
  }

  public async updateAllMemberBalancesAndStatus() {
    const members = await AppDataSource.manager.find(Member)
    for (const member of members) await this.isMemberActive(member.id)
  }

  public async getCurrentPlan(memberId: string): Promise<MemberPlan | null> {
    const { plans } = await this.getBilling(memberId)
    const today = day(new Date())
    return plans.filter(p => day(p.startDate) <= today && (!p.endDate || day(p.endDate) >= today) &&
      (!p.finalBillingDate || p.finalBillingDate >= today))
      .sort((a, b) => day(b.startDate).localeCompare(day(a.startDate)))[0] || null
  }

  public async getCurrentBalance(memberId: string): Promise<number> {
    return (await this.getBilling(memberId)).ledger.balance
  }

  public async getTotalPaid(memberId: string) {
    return (await this.getBilling(memberId)).ledger.totalPaid
  }

  public async getSumOfCharges(memberId: string): Promise<number> {
    return (await this.getBilling(memberId)).ledger.totalCharges
  }
}
