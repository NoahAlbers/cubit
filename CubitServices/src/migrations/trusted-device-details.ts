import { MigrationInterface, QueryRunner } from 'typeorm';
export class TrustedDeviceDetails1790354000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    for (const column of ['deviceDetails', 'lastDeviceDetails'])
      if (!(await runner.hasColumn('trusted_computer', column)))
        await runner.query(`ALTER TABLE trusted_computer ADD COLUMN ${column} text NULL`);
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse this migration.');
  }
}
