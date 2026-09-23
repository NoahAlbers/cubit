import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm'

@Entity()
export class Waiver {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() name: string
  @Column({ default: true }) required: boolean
  @Column({ default: false }) archived: boolean
  @Column({ nullable: true }) currentVersionId: string
  @Column({ default: 0 }) revision: number
}

// Published versions are immutable. A new document always gets a new version.
@Entity()
@Index(['waiverId', 'number'], { unique: true })
export class WaiverVersion {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column() waiverId: string
  @Column() number: number
  @Column() name: string
  @Column({ type: 'text' }) description: string
  @Column({ type: 'text' }) demoText: string
  @Column() provider: string
  @Column({ nullable: true, unique: true }) docusealTemplateId: number
  @Column({ default: 'Member' }) signerRole: string
  @Column() author: string
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}

@Entity()
@Index(['memberId', 'versionId'], { unique: true })
export class WaiverSignature {
  @PrimaryGeneratedColumn('uuid') id: string
  @Index() @Column() memberId: string
  @Column() waiverId: string
  @Column() versionId: string
  @Column() provider: string
  @Column({ default: 'Pending' }) status: string
  @Column() signerEmail: string
  @Column() signerName: string
  @Column({ nullable: true }) submissionId: number
  @Column({ nullable: true }) submitterId: number
  @Column({ nullable: true }) slug: string
  @Column({ type: 'text', nullable: true }) documentUrl: string
  @Column({ nullable: true }) completedAt: Date
  @Column({ default: () => 'CURRENT_TIMESTAMP' }) createdAt: Date
}
