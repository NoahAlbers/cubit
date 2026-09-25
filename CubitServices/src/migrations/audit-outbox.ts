import { MigrationInterface, QueryRunner } from 'typeorm';
export class AuditOutbox1790360000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasTable('audit_outbox')))
      await runner.query(
        `CREATE TABLE audit_outbox (id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY, auditId varchar(36) NOT NULL, payload longtext NOT NULL, deliveredAt datetime NULL, createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE INDEX uq_audit_outbox_id (auditId), INDEX idx_audit_delivery (deliveredAt,id)) ENGINE=InnoDB`,
      );
    const payload = (a: string) =>
      `JSON_OBJECT('id',${a}.id,'memberId',${a}.memberId,'kind',${a}.kind,'author',${a}.author,'detail',${a}.detail,'createdAt',DATE_FORMAT(${a}.createdAt,'%Y-%m-%dT%H:%i:%s.000Z'),'memberName',(SELECT NULLIF(TRIM(CONCAT_WS(' ',firstName,lastName)),'') FROM member WHERE id=${a}.memberId),'memberEmail',(SELECT email FROM member WHERE id=${a}.memberId))`;
    const triggers = await runner.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='cubit_audit_outbox'",
    );
    if (!triggers.length)
      await runner.query(
        `CREATE TRIGGER cubit_audit_outbox AFTER INSERT ON operations_audit FOR EACH ROW INSERT INTO audit_outbox(auditId,payload) VALUES (NEW.id,${payload('NEW')})`,
      );
    await runner.query(
      `INSERT IGNORE INTO audit_outbox(auditId,payload) SELECT a.id,${payload('a')} FROM operations_audit a`,
    );
  }
  async down(): Promise<void> {
    throw Error('Audit delivery history must be preserved; use an operator-reviewed recovery.');
  }
}
