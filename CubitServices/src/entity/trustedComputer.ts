import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('trusted_computer')
export class TrustedComputer {
  @PrimaryColumn({ length: 64 }) tokenHash: string;
  @Index('idx_trusted_member') @Column({ length: 36 }) memberId: string;
  @Index('idx_trusted_proof', { unique: true }) @Column({ length: 64 }) proofHash: string;
  @Column({ type: 'int', unsigned: true }) tokenVersion: number;
  @Column({ type: 'datetime' }) createdAt: Date;
  @Column({ type: 'datetime' }) expiresAt: Date;
  @Column({ type: 'datetime', nullable: true }) lastUsedAt: Date | null;
}
