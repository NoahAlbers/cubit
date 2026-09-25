import { AuditOutbox1790360000000 } from './audit-outbox';
import { HealthHistory1790359000000 } from './health-history';
import { OrganizationCurrency1790357000000 } from './organization-currency';
import { BackupReviews1790358000000 } from './backup-reviews';
import { TrustedComputers1790353000000 } from './trusted-computers';
import { TrustedDeviceDetails1790354000000 } from './trusted-device-details';
import { LoginHistory1790355000000 } from './login-history';
import { OrganizationTimezone1790356000000 } from './organization-timezone';
import { StaffNotificationOptions1790261000000 } from './staff-notifications';
import { UploadAccountLimits1790352000000 } from './upload-security';
import { OrganizationManagement1790260000000 } from './organization';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { baselineTables } from './baseline-schema';
import { staffToolsSql, normalizeLoginEmailsSql } from './legacy-data';

abstract class ForwardMigration implements MigrationInterface {
  transaction = false;
  abstract up(runner: QueryRunner): Promise<void>;
  async down(): Promise<void> {
    throw Error('Restore the operator-reviewed backup to reverse this data-preserving migration.');
  }
}

async function addColumn(runner: QueryRunner, table: string, name: string, definition: string) {
  if (!(await runner.hasColumn(table, name)))
    await runner.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
}

export class ReviewBaseline1790250000000 extends ForwardMigration {
  async up(runner: QueryRunner) {
    // Existing tables are never recreated. Additive compatibility migrations below
    // bring an older local/review copy forward; fresh databases use this frozen DDL.
    if (!(await runner.hasTable('memberkey')) && (await runner.hasTable('memberKey')))
      await runner.renameTable('memberKey', 'memberkey');
    for (const table of baselineTables)
      if (!(await runner.hasTable(table.name))) await runner.query(table.sql);
  }
}
export class MoneyPrecision1790250000001 extends ForwardMigration {
  async up(runner: QueryRunner) {
    for (const [table, column, nullable] of [
      ['plan', 'monthlyCost', false],
      ['transaction', 'amount', false],
      ['member', 'balance', true],
    ] as const) {
      const existing = (await runner.getTable(table))?.findColumnByName(column);
      if (existing && existing.type !== 'decimal')
        await runner.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DECIMAL(10,2) ${nullable ? 'NULL' : 'NOT NULL'}`,
        );
    }
  }
}
export class AccountSecurity1790250000002 extends ForwardMigration {
  async up(runner: QueryRunner) {
    await addColumn(runner, 'member', 'tokenVersion', 'int unsigned NOT NULL DEFAULT 0');
    await addColumn(runner, 'member', 'loginDisabled', 'tinyint NOT NULL DEFAULT 0');
  }
}
export class WaiverDocuments1790250000003 extends ForwardMigration {
  async up(runner: QueryRunner) {
    await addColumn(runner, 'waiver_version', 'providerFingerprint', 'varchar(255) NULL');
  }
}
export class BillingCatalog1790250000004 extends ForwardMigration {
  async up(runner: QueryRunner) {
    await addColumn(runner, 'plan', 'revision', 'int NOT NULL DEFAULT 1');
    for (const name of ['payerEmail', 'payerName'])
      await addColumn(runner, 'payment_event', name, "varchar(255) NOT NULL DEFAULT ''");
  }
}
export class KeyHistory1790250000005 extends ForwardMigration {
  async up(runner: QueryRunner) {
    await addColumn(runner, 'access_log', 'memberKeyId', 'varchar(36) NULL');
    // A UUID evaluated at module import became a fixed SQL default. Existing IDs
    // stay untouched; key creation already supplies a new UUID for every insert.
    await runner.query('ALTER TABLE memberkey ALTER COLUMN id DROP DEFAULT');
  }
}
export class StaffHistory1790250000006 extends ForwardMigration {
  async up(runner: QueryRunner) {
    try {
      for (const statement of staffToolsSql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await runner.query(statement);
    } catch (error) {
      await runner.query('ROLLBACK');
      throw error;
    }
    for (const [name, columns] of [
      ['idx_audit_time', 'createdAt,id'],
      ['idx_audit_member_time', 'memberId,createdAt'],
      ['idx_audit_author', 'author'],
    ]) {
      const found = await runner.query(
        "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='operations_audit' AND INDEX_NAME=?",
        [name],
      );
      if (!found.length)
        await runner.query(`CREATE INDEX ${name} ON operations_audit (${columns})`);
    }
  }
}
export class NormalizeLoginEmails1790250000007 extends ForwardMigration {
  async up(runner: QueryRunner) {
    try {
      for (const statement of normalizeLoginEmailsSql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await runner.query(statement);
    } catch (error) {
      await runner.query('ROLLBACK');
      throw error;
    }
  }
}

export class StableIndexNames1790250000008 extends ForwardMigration {
  async up(runner: QueryRunner) {
    for (const [table, column, name] of [
      ['account_link', 'memberId', 'idx_account_link_member'],
      ['backup_job', 'status', 'idx_backup_status'],
      ['waiver_document', 'memberId', 'idx_waiver_doc_member'],
      ['waiver_document', 'versionId', 'idx_waiver_doc_version'],
      ['waiver_document', 'signatureId', 'idx_waiver_doc_signature'],
      ['waiver_document', 'status', 'idx_waiver_doc_status'],
    ]) {
      const indexes = (await runner.getTable(table))!.indices;
      if (indexes.some((index) => index.name === name)) continue;
      const equivalent = indexes.find(
        (index) =>
          !index.isUnique && index.columnNames.length === 1 && index.columnNames[0] === column,
      );
      if (equivalent)
        await runner.query(
          `ALTER TABLE \`${table}\` RENAME INDEX \`${equivalent.name}\` TO \`${name}\``,
        );
      else await runner.query(`CREATE INDEX \`${name}\` ON \`${table}\` (\`${column}\`)`);
    }
  }
}

import { ParallelSubscriptions1790361000000 } from './parallel-subscriptions';

export const migrations = [
  ReviewBaseline1790250000000,
  MoneyPrecision1790250000001,
  AccountSecurity1790250000002,
  WaiverDocuments1790250000003,
  BillingCatalog1790250000004,
  KeyHistory1790250000005,
  StaffHistory1790250000006,
  NormalizeLoginEmails1790250000007,
  StableIndexNames1790250000008,
  OrganizationManagement1790260000000,
  StaffNotificationOptions1790261000000,
  UploadAccountLimits1790352000000,
  TrustedComputers1790353000000,
  TrustedDeviceDetails1790354000000,
  LoginHistory1790355000000,
  OrganizationTimezone1790356000000,
  OrganizationCurrency1790357000000,
  BackupReviews1790358000000,
  HealthHistory1790359000000,
  AuditOutbox1790360000000,
  ParallelSubscriptions1790361000000,
];
