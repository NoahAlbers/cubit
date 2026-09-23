import { EntityManager } from 'typeorm'
import { AccessLog } from '../entity/accessLog'
import { MemberKey } from '../entity/memberKey'

export async function memberActivity(manager: EntityManager, memberId: string, now = new Date()) {
  const [keys, usage] = await Promise.all([
    manager.find(MemberKey, { where: { memberId }, order: { serialNumber: 'ASC' } }),
    manager.createQueryBuilder(AccessLog, 'log')
      .select('log.memberKeyId', 'keyId').addSelect('MAX(log.timestamp)', 'lastUsed')
      .where('log.memberId = :memberId', { memberId })
      .andWhere('log.accessGranted = :granted', { granted: true })
      .andWhere('log.timestamp <= :now', { now })
      .groupBy('log.memberKeyId').getRawMany(),
  ])
  const byKey = new Map(usage.map(row => [row.keyId, new Date(row.lastUsed).toISOString()]))
  const entries = [...byKey.values()].sort()
  return {
    lastEntry: entries.length ? entries[entries.length - 1] : null,
    keys: keys.map(key => ({ ...key, lastUsed: byKey.get(key.id) || null })),
  }
}
