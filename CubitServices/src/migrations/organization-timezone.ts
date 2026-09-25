import { MigrationInterface, QueryRunner } from 'typeorm';
export class OrganizationTimezone1790356000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasColumn('organization_settings', 'timezone')))
      await runner.query(
        "ALTER TABLE organization_settings ADD COLUMN timezone varchar(64) NOT NULL DEFAULT 'America/New_York'",
      );
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse this migration.');
  }
}
