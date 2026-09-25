import { Entity, Column, PrimaryColumn, Index } from 'typeorm';
@Entity()
export class BackupSettings {
  @PrimaryColumn() id: string;
  @Column({ type: 'text' }) settings: string;
  @Column({ default: 1 }) revision: number;
}
@Entity()
export class BackupJob {
  @Column({ type: 'datetime', nullable: true }) reviewedAt: Date | null;
  @Column({ type: 'varchar', length: 254, nullable: true }) reviewedBy: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) reviewNote: string | null;
  @Column({ default: 0 }) reviewRevision: number;
  @PrimaryColumn() id: string;
  @Column() kind: string;
  @Index('idx_backup_status') @Column({ default: 'Queued' }) status: string;
  @Column() requestedBy: string;
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
  @Column({ nullable: true }) startedAt: Date;
  @Column({ nullable: true }) finishedAt: Date;
  @Column({ type: 'text', nullable: true }) result: string;
}
@Entity()
export class BackupRuntime {
  @PrimaryColumn() id: string;
  @Column({ type: 'text' }) detail: string;
  @Column() heartbeat: Date;
}
