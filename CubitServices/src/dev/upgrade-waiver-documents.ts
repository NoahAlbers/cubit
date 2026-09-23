import {DataSource} from 'typeorm'
import fs from 'fs'
import path from 'path'
export async function upgradeWaiverDocuments(source:DataSource,apply:boolean){
  if(apply)await source.query(fs.readFileSync(path.resolve('src/dev/waiver-documents.sql'),'utf8'))
  else await source.query('SELECT id FROM waiver_document LIMIT 0')
  const columns=await source.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='waiver_version' AND COLUMN_NAME='providerFingerprint'")
  if(!columns.length&&apply){
    const tables=await source.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='waiver_version'")
    if(tables.length)await source.query('ALTER TABLE waiver_version ADD COLUMN providerFingerprint varchar(255) NULL')
  }else if(!columns.length)throw Error('Waiver version migration is required.')
}
