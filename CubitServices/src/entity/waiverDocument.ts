import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

// Documents live in the private database, never the public web directory.
// Content is excluded from ordinary queries and included in database backups.
@Entity()
export class WaiverDocument {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index('idx_waiver_doc_member') @Column({ nullable: true }) memberId: string;
  @Index('idx_waiver_doc_version') @Column({ nullable: true }) versionId: string;
  @Index('idx_waiver_doc_signature') @Column({ nullable: true }) signatureId: string;
  @Column() filename: string;
  @Column() mime: string;
  @Column() bytes: number;
  @Column() sha256: string;
  @Column({ type: 'longblob', select: false }) content: Buffer;
  @Column() source: string;
  @Index('idx_waiver_doc_status') @Column() status: string;
  @Column() uploadedBy: string;
  @Index('idx_waiver_doc_uploader')
  @Column({ type: 'varchar', length: 36, nullable: true })
  uploadedById: string | null;
  @Column({ nullable: true }) reviewedBy: string;
  @Column({ nullable: true }) reviewedAt: Date;
  @Column({ type: 'text', nullable: true }) reviewNote: string;
  @Column({ default: 1 }) revision: number;
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date;
}
