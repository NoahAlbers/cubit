import { DataSource, TableColumn } from 'typeorm'
import { AccessLog } from '../entity/accessLog'

// Add only the nullable key reference; do not synchronize imported tables.
export async function upgradeKeyHistory(source: DataSource) {
  const runner = source.createQueryRunner()
  try {
    const table = source.getMetadata(AccessLog).tableName
    if (!await runner.hasColumn(table, 'memberKeyId')) {
      await runner.addColumn(table, new TableColumn({
        name: 'memberKeyId', type: 'varchar', length: '36', isNullable: true,
      }))
    }
  } finally { await runner.release() }
}
