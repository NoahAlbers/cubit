import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationManagement1790260000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasTable('organization_settings')))
      await runner.query(
        'CREATE TABLE organization_settings (id varchar(32) NOT NULL, name varchar(120) NOT NULL, supportEmail varchar(254) NOT NULL, revision int NOT NULL DEFAULT 1, PRIMARY KEY (id)) ENGINE=InnoDB',
      );
    await runner.query(
      "INSERT IGNORE INTO organization_settings (id,name,supportEmail) VALUES ('default','Melbourne Makerspace','webmaster@melbournemakerspace.org')",
    );
    if (!(await runner.hasColumn('member', 'staffVersion')))
      await runner.query(
        'ALTER TABLE member ADD COLUMN staffVersion int unsigned NOT NULL DEFAULT 0',
      );
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse organization management.');
  }
}
