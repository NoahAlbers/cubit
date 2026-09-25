import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity({ name: 'organization_settings' })
export class OrganizationSettings {
  @Column({ length: 64, default: 'America/New_York' }) timezone: string;
  @PrimaryColumn({ type: 'varchar', length: 32 }) id: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 254 }) supportEmail: string;
  @Column({ type: 'int', default: 1 }) revision: number;
}
