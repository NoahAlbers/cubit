START TRANSACTION;
SELECT id FROM operations_settings WHERE id='default' FOR UPDATE;
UPDATE member SET tokenVersion=tokenVersion
WHERE CAST(email AS BINARY) <> CAST(REGEXP_REPLACE(email, '^[[:space:]]+|[[:space:]]+$', '') AS BINARY);
INSERT INTO operations_audit (id,memberId,kind,author,detail,createdAt)
SELECT UUID(),id,'Login email whitespace corrected','Deployment operator',
  JSON_OBJECT('version',1,'actorType','system','entityId',id,
    'before',JSON_OBJECT('email',email),
    'after',JSON_OBJECT('email',REGEXP_REPLACE(email, '^[[:space:]]+|[[:space:]]+$', '')),
    'reason','Remove imported leading and trailing whitespace while preserving the member record'),CURRENT_TIMESTAMP
FROM member WHERE CAST(email AS BINARY) <> CAST(REGEXP_REPLACE(email, '^[[:space:]]+|[[:space:]]+$', '') AS BINARY);
UPDATE member SET email=REGEXP_REPLACE(email, '^[[:space:]]+|[[:space:]]+$', ''),tokenVersion=tokenVersion+1
WHERE CAST(email AS BINARY) <> CAST(REGEXP_REPLACE(email, '^[[:space:]]+|[[:space:]]+$', '') AS BINARY);
COMMIT;
