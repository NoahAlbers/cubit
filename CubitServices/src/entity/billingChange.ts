import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class BillingChange {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() memberId: string;
  @Column() memberPlanId: string;
  @Column({ type: 'date', nullable: true }) previousDate: string | null;
  @Column({ type: 'date' }) finalBillingDate: string;
  @Column() reason: string;
  @Column() changedBy: string;
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) changedAt: Date;
}
