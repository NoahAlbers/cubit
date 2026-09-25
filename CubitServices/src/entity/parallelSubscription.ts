import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

// Local annotations only; never overwrite a source membership during snapshot refresh.
@Entity({ name: 'parallel_subscription_link' })
@Index('uq_subscription_account', ['merchantAccount', 'subscriptionId'], { unique: true })
export class ParallelSubscriptionLink {
  @PrimaryColumn({ length: 255 }) membershipId: string;
  @Column({ length: 255 }) memberId: string;
  @Column({ length: 64 }) merchantAccount: string;
  @Column({ length: 64 }) subscriptionId: string;
  @Column({ length: 64, default: '' }) subscriptionPlanId: string;
  @Column({ length: 255 }) reason: string;
  @Column({ length: 255 }) confirmedBy: string;
  @Column({ type: 'datetime' }) confirmedAt: Date;
  @Column({ type: 'int', default: 1 }) revision: number;
}
