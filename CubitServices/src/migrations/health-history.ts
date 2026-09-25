import { MigrationInterface, QueryRunner } from 'typeorm';
export class HealthHistory1790359000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasTable('health_sample')))
      await runner.query(
        `CREATE TABLE health_sample (id varchar(40) NOT NULL PRIMARY KEY, resolution varchar(8) NOT NULL, startedAt datetime NOT NULL, payload text NOT NULL, INDEX idx_health_resolution_time (resolution,startedAt)) ENGINE=InnoDB`,
      );
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse health history.');
  }
}
