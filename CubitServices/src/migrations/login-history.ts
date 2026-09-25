import { MigrationInterface, QueryRunner } from 'typeorm';
export class LoginHistory1790355000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasTable('login_history')))
      await runner.query(`CREATE TABLE login_history (
        id varchar(36) NOT NULL PRIMARY KEY, memberId varchar(36) NOT NULL,
        createdAt datetime NOT NULL, method varchar(32) NOT NULL,
        deviceDetails text NOT NULL, location varchar(255) NULL,
        INDEX idx_login_member_time (memberId, createdAt, id)) ENGINE=InnoDB`);
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse login history.');
  }
}
