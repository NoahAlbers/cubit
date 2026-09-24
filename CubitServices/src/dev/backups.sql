CREATE TABLE IF NOT EXISTS backup_settings (id varchar(255) PRIMARY KEY, settings text NOT NULL, revision int NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS backup_job (id varchar(255) PRIMARY KEY, kind varchar(255) NOT NULL, status varchar(255) NOT NULL DEFAULT 'Queued', requestedBy varchar(255) NOT NULL, createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, startedAt datetime NULL, finishedAt datetime NULL, result text NULL, INDEX idx_backup_status(status));
CREATE TABLE IF NOT EXISTS backup_runtime (id varchar(255) PRIMARY KEY, detail text NOT NULL, heartbeat datetime NOT NULL);
