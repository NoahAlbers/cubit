import { DataSource } from 'typeorm'

// Additive operator migration until the versioned migration baseline is adopted.
// Hosted application users only verify the columns; they never execute DDL.
export async function upgradeAccountSecurity(source: DataSource, apply: boolean) {
  const columns = await source.query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='member'")
  if (!columns.length) return // Empty demo schemas are initialized separately.
  for (const [name, definition] of [['tokenVersion', 'int unsigned NOT NULL DEFAULT 0'], ['loginDisabled', 'tinyint NOT NULL DEFAULT 0']]) {
    if (columns.some((c: {name: string}) => c.name === name)) continue
    if (!apply) throw Error('Account security migration is required before startup.')
    await source.query(`ALTER TABLE member ADD COLUMN ${name} ${definition}`)
  }
}
