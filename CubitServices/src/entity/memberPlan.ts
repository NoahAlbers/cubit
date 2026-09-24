import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Member } from './member';
import { Plan } from './plan';

//see https://typeorm.io/#/entities/ for how entities work
@Entity()
export class MemberPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  billingRate: number | null;

  @Column({ nullable: true })
  billingName: string;

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options
  @Column()
  startDate: Date;

  @Column({ nullable: true })
  endDate: Date;

  // Inclusive last date on which a monthly charge may be incurred.
  @Column({ type: 'date', nullable: true })
  finalBillingDate: string | null;

  @Column()
  memberId: string;

  @Column()
  paypalSubscriptionId: string;

  @Column()
  paypalSubscriptionPlanId: string;

  @ManyToOne(() => Member)
  @JoinColumn()
  member: Member;

  @Column()
  planId: string;

  @ManyToOne(() => Plan)
  @JoinColumn()
  plan: Plan;
}
