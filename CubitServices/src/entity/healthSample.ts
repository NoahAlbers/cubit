import { Entity, PrimaryColumn, Column, Index } from 'typeorm';
@Entity('health_sample')
@Index('idx_health_resolution_time', ['resolution', 'startedAt'])
export class HealthSample {
  @PrimaryColumn({ length: 40 }) id: string;
  @Column({ length: 8 }) resolution: string;
  @Column({ type: 'datetime' }) startedAt: Date;
  @Column({ type: 'text' }) payload: string;
}
