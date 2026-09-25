import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('account_throttle')
export class AccountThrottle {
  @PrimaryColumn({ length: 80 }) id: string;
  @Column({ default: 0 }) attempts: number;
  @Column({ default: 0 }) level: number;
  @Column({ default: 0 }) revision: number;
  @Column({ type: 'datetime' }) windowStart: Date;
  @Column({ type: 'datetime', nullable: true }) blockedUntil: Date | null;
}
