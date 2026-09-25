import { MigrationInterface, QueryRunner } from 'typeorm';
export class ParallelSubscriptions1790361000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(`CREATE TABLE IF NOT EXISTS parallel_subscription_link (
      membershipId varchar(255) NOT NULL, memberId varchar(255) NOT NULL,
      merchantAccount varchar(64) NOT NULL, subscriptionId varchar(64) NOT NULL,
      subscriptionPlanId varchar(64) NOT NULL DEFAULT '', reason varchar(255) NOT NULL,
      confirmedBy varchar(255) NOT NULL, confirmedAt datetime NOT NULL, revision int NOT NULL DEFAULT 1,
      PRIMARY KEY(membershipId), UNIQUE INDEX uq_subscription_account(merchantAccount,subscriptionId)
    ) ENGINE=InnoDB`);
  }
  async down() {
    throw Error('Restore a verified backup instead of removing subscription history.');
  }
}
