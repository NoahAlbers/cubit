import { MigrationInterface, QueryRunner } from 'typeorm';
export class BackupReviews1790358000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    for (const [name, type] of [
      ['reviewedAt', 'datetime NULL'],
      ['reviewedBy', 'varchar(254) NULL'],
      ['reviewNote', 'varchar(500) NULL'],
      ['reviewRevision', 'int NOT NULL DEFAULT 0'],
    ])
      if (!(await runner.hasColumn('backup_job', name)))
        await runner.query(`ALTER TABLE backup_job ADD COLUMN ${name} ${type}`);
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse backup reviews.');
  }
}
