import { TopicChoices, DeliveryOptions } from '../staff/notification-options';
import { Entity, PrimaryColumn, Column } from 'typeorm';
@Entity()
export class StaffAlertPreference {
  @PrimaryColumn({ length: 36 }) staffId: string;
  @Column({ default: false }) enabled: boolean;
  @Column({ default: false }) unknownFobs: boolean;
  @Column({ default: false }) refusedFobs: boolean;
  @Column({ default: 15 }) dedupeMinutes: number;
  @Column({ default: 1 }) revision: number;
  @Column({ type: 'simple-json', nullable: true }) topics: TopicChoices | null;
  @Column({ type: 'simple-json', nullable: true }) delivery: DeliveryOptions | null;
}
