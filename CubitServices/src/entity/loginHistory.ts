import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
@Entity('login_history')
@Index('idx_login_member_time', ['memberId', 'createdAt', 'id'])
export class LoginHistory {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 36 }) memberId: string;
  @Column({ type: 'datetime' }) createdAt: Date;
  @Column({ length: 32 }) method: string;
  @Column({ type: 'text' }) deviceDetails: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) location: string | null;
}
