import { MigrationInterface, QueryRunner } from 'typeorm';
export class StaffNotificationOptions1790261000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    for (const column of ['topics', 'delivery'])
      if (!(await runner.hasColumn('staff_alert_preference', column)))
        await runner.query(`ALTER TABLE staff_alert_preference ADD COLUMN ${column} text NULL`);
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse notification preferences.');
  }
}
