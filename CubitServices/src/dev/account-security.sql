CREATE TABLE IF NOT EXISTS account_link (
  tokenHash varchar(64) NOT NULL PRIMARY KEY,
  memberId varchar(36) NOT NULL,
  purpose varchar(16) NOT NULL,
  email varchar(255) NOT NULL,
  tokenVersion int unsigned NOT NULL,
  expiresAt datetime NOT NULL,
  usedAt datetime NULL,
  INDEX idx_account_link_member (memberId)
);
CREATE TABLE IF NOT EXISTS account_mfa (
  memberId varchar(36) NOT NULL PRIMARY KEY,
  secret text NULL,
  pendingSecret text NULL,
  pendingExpiresAt datetime NULL,
  lastStep bigint NOT NULL DEFAULT -1,
  recoveryHashes text NULL
);
CREATE TABLE IF NOT EXISTS account_notice (
  id varchar(36) NOT NULL PRIMARY KEY,
  memberId varchar(36) NOT NULL,
  previousEmail varchar(255) NOT NULL,
  newEmail varchar(255) NOT NULL,
  createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  acknowledgedAt datetime NULL,
  acknowledgedBy varchar(36) NULL
);
