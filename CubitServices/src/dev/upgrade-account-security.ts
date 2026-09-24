import { DataSource } from 'typeorm'
import fs from 'fs'
import path from 'path'

// Additive operator migration until the versioned migration baseline is adopted.
// Hosted application users only verify the columns; they never execute DDL.
export async function upgradeAccountSecurity(source: DataSource, apply: boolean) {
  if(apply){for(const sql of fs.readFileSync(path.resolve('src/dev/account-security.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean))await source.query(sql)}
  else {
    const tables=await source.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('account_link','account_mfa','account_notice')")
    if(tables.length!==3)throw Error('Account security migration is required before startup.')
  }
  const columns = await source.query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='member'")
  if (!columns.length) return // Empty demo schemas are initialized separately.
  for (const [name, definition] of [['tokenVersion', 'int unsigned NOT NULL DEFAULT 0'], ['loginDisabled', 'tinyint NOT NULL DEFAULT 0']]) {
    if (columns.some((c: {name: string}) => c.name === name)) continue
    if (!apply) throw Error('Account security migration is required before startup.')
    await source.query(`ALTER TABLE member ADD COLUMN ${name} ${definition}`)
  }
}

export async function normalizeLoginEmails(source:DataSource){
  const runner=source.createQueryRunner();await runner.connect()
  try{for(const sql of fs.readFileSync(path.resolve('src/dev/normalize-login-emails.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean))await runner.query(sql)}
  catch(error){await runner.query('ROLLBACK');throw error}finally{await runner.release()}
}
