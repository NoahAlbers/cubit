CREATE TABLE IF NOT EXISTS waiver_document (
 id varchar(36) NOT NULL PRIMARY KEY, memberId varchar(255) NULL, versionId varchar(255) NULL, signatureId varchar(255) NULL,
 filename varchar(255) NOT NULL, mime varchar(255) NOT NULL, bytes int NOT NULL, sha256 varchar(255) NOT NULL,
 content longblob NOT NULL, source varchar(255) NOT NULL, status varchar(255) NOT NULL, uploadedBy varchar(255) NOT NULL,
 reviewedBy varchar(255) NULL, reviewedAt datetime NULL, reviewNote text NULL, revision int NOT NULL DEFAULT 1,
 createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_waiver_doc_member(memberId), INDEX idx_waiver_doc_version(versionId), INDEX idx_waiver_doc_signature(signatureId), INDEX idx_waiver_doc_status(status)
);
