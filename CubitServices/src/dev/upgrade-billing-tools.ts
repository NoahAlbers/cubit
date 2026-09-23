import { DataSource } from 'typeorm'
import { PaymentEvent } from '../entity/cubitOperations'
import { Plan } from '../entity/plan'

// Local workspaces can migrate themselves. Hosted schemas are migrated by the
// deployment operator, never with the application's restricted DB credentials.
export async function upgradeBillingTools(source:DataSource, apply:boolean) {
  const runner=source.createQueryRunner()
  try {
    for(const [entity,fields] of [[PaymentEvent,['payerEmail','payerName']],[Plan,['revision']]] as const) {
      const meta=source.getMetadata(entity),table=await runner.getTable(meta.tablePath)
      if(!table)continue // A new synthetic schema is created by synchronize.
      for(const property of fields) {
        const column=meta.findColumnWithPropertyName(property)!
        if(table.findColumnByName(column.databaseName))continue
        if(!apply)throw Error('Billing tools migration is required before starting this release.')
        const definition=property==='revision'?'int NOT NULL DEFAULT 1':"varchar(255) NOT NULL DEFAULT ''"
        await runner.query(`ALTER TABLE \`${meta.tableName}\` ADD COLUMN \`${column.databaseName}\` ${definition}`)
      }
    }
  } finally { await runner.release() }
}
