import { Entity, PrimaryColumn, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm'

@Entity('account_notice')
export class AccountNotice {
  @PrimaryGeneratedColumn('uuid') id: string
  @Column({length:36}) memberId: string
  @Column() previousEmail: string
  @Column() newEmail: string
  @CreateDateColumn() createdAt: Date
  @Column({type:'datetime',nullable:true}) acknowledgedAt: Date | null
  @Column({type:'varchar',length:36,nullable:true}) acknowledgedBy: string | null
}

@Entity('account_link')
export class AccountLink {
  @PrimaryColumn({length:64}) tokenHash: string
  @Index() @Column({length:36}) memberId: string
  @Column({length:16}) purpose: string
  @Column() email: string
  @Column({type:'int',unsigned:true}) tokenVersion: number
  @Column({type:'datetime'}) expiresAt: Date
  @Column({type:'datetime',nullable:true}) usedAt: Date | null
}

@Entity('account_mfa')
export class AccountMfa {
  @PrimaryColumn({length:36}) memberId: string
  @Column({type:'text',nullable:true}) secret: string | null
  @Column({type:'text',nullable:true}) pendingSecret: string | null
  @Column({type:'datetime',nullable:true}) pendingExpiresAt: Date | null
  @Column({type:'bigint',default:-1}) lastStep: string
  @Column({type:'text',nullable:true}) recoveryHashes: string | null
}
