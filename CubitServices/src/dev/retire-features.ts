import { DataSource } from 'typeorm'

// Email notifications have been retired. Remove the obsolete local draft store.
// Member/settings columns are retired by the normal local schema synchronization.
export async function retireUnusedFeatures(source: DataSource) {
  const runner=source.createQueryRunner()
  try {
    if(await runner.hasTable('notification_draft'))await runner.dropTable('notification_draft')
  } finally { await runner.release() }
}
