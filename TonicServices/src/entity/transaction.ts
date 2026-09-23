import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Member } from './member';

//see https://typeorm.io/#/entities/ for how entities work
@Entity()
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, unique: true }) requestKey: string;
  @Column({ nullable: true }) reversalOf: string;
  @Column({ nullable: true }) correctedBy: string;
  @Column({ nullable: true }) recordedBy: string;
  @Column({ nullable: true }) correctionReason: string;
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;

  //see https://typeorm.io/#/entities/column-types-for-mysql--mariadb for type options

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: Number;

  @Column({ nullable: true })
  confirmation: string;

  @Column({ nullable: false })
  transactionDate: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  memberId: string;

  @ManyToOne(() => Member)
  member: Member;

  @Column({ nullable: true })
  method: string;

  @Column({ nullable: true })
  paypalEmail: string;

  @Column({ nullable: true })
  paypalMemberId: string;

  @Column({ nullable: true })
  paypalName: string;
}
