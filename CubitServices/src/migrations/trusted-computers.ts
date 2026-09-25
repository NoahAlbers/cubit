import { MigrationInterface, QueryRunner } from 'typeorm';
export class TrustedComputers1790353000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasTable('trusted_computer')))
      await runner.query(`CREATE TABLE trusted_computer (
      tokenHash varchar(64) NOT NULL, memberId varchar(36) NOT NULL, proofHash varchar(64) NOT NULL,
      tokenVersion int UNSIGNED NOT NULL, createdAt datetime NOT NULL, expiresAt datetime NOT NULL,
      lastUsedAt datetime NULL, PRIMARY KEY (tokenHash), INDEX idx_trusted_member (memberId),
      UNIQUE INDEX idx_trusted_proof (proofHash)) ENGINE=InnoDB`);
  }
  async down(): Promise<void> {
    throw Error('Use an operator-reviewed backup to reverse trusted-computer support.');
  }
}
