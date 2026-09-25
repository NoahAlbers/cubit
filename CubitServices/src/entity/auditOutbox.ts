import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
@Entity('audit_outbox')
@Index('idx_audit_delivery', ['deliveredAt', 'id'])
export class AuditOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Index('uq_audit_outbox_id', { unique: true }) @Column({ length: 36 }) auditId: string;
  @Column({ type: 'longtext' }) payload: string;
  @Column({ type: 'datetime', nullable: true }) deliveredAt: Date | null;
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
}
