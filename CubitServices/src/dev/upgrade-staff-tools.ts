import {DataSource} from 'typeorm'
import fs from 'fs'
import path from 'path'
export async function upgradeStaffTools(source:DataSource,apply:boolean) {
  if(!apply){
    const rows=await source.query("SELECT id FROM cubit_staff_tools_manifest WHERE id='audit-baseline-v1'")
    if(rows.length!==1)throw Error('Staff tools migration is required before startup.')
    return
  }
  const runner=source.createQueryRunner()
  try {
    const sql=fs.readFileSync(path.resolve('src/dev/staff-tools.sql'),'utf8')
    for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await runner.query(statement)
    for(const [name,columns] of [['idx_audit_time','createdAt,id'],['idx_audit_member_time','memberId,createdAt'],['idx_audit_author','author']] ) {
      const found=await runner.query('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=\'operations_audit\' AND INDEX_NAME=?',[name])
      if(!found.length)await runner.query(`CREATE INDEX ${name} ON operations_audit (${columns})`)
    }
  } catch(error){await runner.query('ROLLBACK');throw error}finally{await runner.release()}
}
