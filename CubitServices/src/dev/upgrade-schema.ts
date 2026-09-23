import { DataSource } from 'typeorm'

// TypeORM synchronize can drop/recreate a column when its type changes.
// Convert existing money columns in place before local schema synchronization.
// Production deployment needs a separately reviewed migration, not synchronize.
export async function upgradeLocalMoneyColumns(source: DataSource) {
  const runner = source.createQueryRunner()
  try {
    for (const [table, column, nullable] of [
      ['plan', 'monthlyCost', false], ['transaction', 'amount', false], ['member', 'balance', true],
    ] as const) {
      const metadata = await runner.getTable(table)
      const existing = metadata?.findColumnByName(column)
      if (existing && existing.type !== 'decimal') {
        // Identifiers are fixed above; there is no user input in this statement.
        await runner.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` DECIMAL(10,2) ${nullable ? 'NULL' : 'NOT NULL'}`)
      }
    }
  } finally { await runner.release() }
}
