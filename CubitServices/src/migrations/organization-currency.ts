import { MigrationInterface, QueryRunner } from 'typeorm';
export class OrganizationCurrency1790357000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasColumn('organization_settings', 'currency')))
      await runner.query(
        "ALTER TABLE organization_settings ADD COLUMN currency varchar(3) NOT NULL DEFAULT 'USD'",
      );
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse this migration.');
  }
}
