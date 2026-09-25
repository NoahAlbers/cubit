import { MigrationInterface, QueryRunner } from 'typeorm';

export class UploadAccountLimits1790352000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    if (!(await runner.hasColumn('waiver_document', 'uploadedById')))
      await runner.query('ALTER TABLE waiver_document ADD COLUMN uploadedById varchar(36) NULL');
    const table = await runner.getTable('waiver_document');
    if (!table!.indices.some((i) => i.name === 'idx_waiver_doc_uploader'))
      await runner.query('CREATE INDEX idx_waiver_doc_uploader ON waiver_document (uploadedById)');
    // Portal uploads always belong to their uploader, even after their email changes.
    await runner.query(
      "UPDATE waiver_document SET uploadedById=memberId WHERE uploadedById IS NULL AND source='member upload' AND memberId IS NOT NULL",
    );
    // Historical staff uploads are attributed only where the saved email has one match.
    await runner.query(`UPDATE waiver_document d JOIN
      (SELECT LOWER(TRIM(email)) email, MIN(id) id FROM member GROUP BY LOWER(TRIM(email)) HAVING COUNT(*)=1) m
      ON LOWER(TRIM(d.uploadedBy))=m.email SET d.uploadedById=m.id
      WHERE d.uploadedById IS NULL AND d.source IN ('staff upload','template')`);
    if (!(await runner.hasTable('account_throttle')))
      await runner.query(`CREATE TABLE account_throttle (
        id varchar(80) NOT NULL, attempts int NOT NULL DEFAULT 0, level int NOT NULL DEFAULT 0,
        revision int NOT NULL DEFAULT 0, windowStart datetime NOT NULL, blockedUntil datetime NULL,
        PRIMARY KEY (id)) ENGINE=InnoDB`);
  }
  async down(): Promise<void> {
    throw Error('Restore an operator-reviewed backup to reverse upload security.');
  }
}
