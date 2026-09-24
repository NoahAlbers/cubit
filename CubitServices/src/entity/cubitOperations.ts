import { Entity, Column, PrimaryColumn, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity()
export class StaffNote {
  @PrimaryGeneratedColumn('uuid') id: string
  @Index() @Column() memberId: string
  @Column({ type: 'text' }) text: string
  @Column() author: string
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}

@Entity()
@Index(['memberPlanId', 'dueDate'], { unique: true })
export class BillingCharge {
  @PrimaryGeneratedColumn('uuid') id: string
  @Index({ unique: true }) @Column({ nullable: true }) requestKey?: string
  @Column({ nullable: true }) createdBy?: string
  @Index() @Column() memberId: string
  @Column() memberPlanId: string
  @Column() planName: string
  @Column({ type: 'date' }) dueDate: string
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount: number
  @Column({ default: false }) voided: boolean
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}

@Entity()
export class ChargeAdjustment {
  @PrimaryGeneratedColumn('uuid') id: string
  @Index() @Column() memberId: string
  @Column() chargeId: string
  @Column({ type: 'decimal', precision: 10, scale: 2 }) credit: number
  @Column({ length: 500 }) reason: string
  @Column() author: string
  @Index({ unique: true }) @Column() requestKey: string
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}

@Entity()
export class OperationsSettings {
  @PrimaryColumn() id: string
  @Column({ default: 60 }) graceDays: number
  @Column({ default: true }) dailyEnabled: boolean
  @Column({ default: 1 }) version: number
  @Column({ type: 'text', nullable: true }) migrationSummary: string | null
}

@Entity()
@Index('idx_audit_time', ['createdAt', 'id'])
@Index('idx_audit_member_time', ['memberId', 'createdAt'])
@Index('idx_audit_author', ['author'])
export class OperationsAudit {
  @PrimaryGeneratedColumn('uuid') id: string
  @Index() @Column({ nullable: true }) memberId: string
  @Column() kind: string
  @Column() author: string
  @Column({ type: 'text' }) detail: string
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}

@Entity()
export class AutomationRun {
  @PrimaryColumn() id: string
  @Column() status: string
  @Column() trigger: string
  @Column({ type: 'text' }) summary: string
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}

@Entity()
export class PaymentEvent {
  @PrimaryColumn() id: string
  @Column({ default: '' }) payerEmail: string
  @Column({ default: '' }) payerName: string
  @Column() kind: string
  @Column() resourceId: string
  @Column({ default: '' }) subscriptionId: string
  @Column({ default: '' }) parentResourceId: string
  @Column({ default: '' }) memberId: string
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) amount: number
  @Column({ type: 'date' }) eventDate: string
  @Column() payloadHash: string
  @Column({ default: 'Unmatched' }) status: string
  @Column({ type: 'text' }) detail: string
  @Column({ default: 0 }) attempts: number
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}
