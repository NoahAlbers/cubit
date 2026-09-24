import {DataSource} from 'typeorm'
import fs from 'fs'
import path from 'path'
export async function upgradeBackups(db:DataSource,apply:boolean){
 if(apply)for(const sql of fs.readFileSync(path.resolve('src/dev/backups.sql'),'utf8').split(';').filter(s=>s.trim()))await db.query(sql)
 else await db.query('SELECT id FROM backup_settings LIMIT 0')
}
