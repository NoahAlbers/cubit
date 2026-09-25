import { localConfig } from '../dev/config';
import { AppDataSource } from '../database';
import { auditDetail } from './audit';
import { BackupRuntime } from '../entity/backup';
import { OperationsAudit } from '../entity/cubitOperations';
import { organizationTimeZone, startOfOrganizationDay } from '../organization/time';

export function vaultConfigured() {
  return (
    localConfig.runtimeMode === 'hosted-review' &&
    !!process.env.AUDIT_VAULT_URL &&
    !!process.env.AUDIT_VAULT_READ_TOKEN
  );
}
export async function vaultRequest(path: string) {
  if (!vaultConfigured()) throw Error('Archive is not configured');
  const base = new URL(process.env.AUDIT_VAULT_URL!);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash)
    throw Error('Invalid archive configuration');
  const response = await fetch(base.href.replace(/\/?$/, '/') + path.replace(/^\//, ''), {
    headers: { Authorization: 'Bearer ' + process.env.AUDIT_VAULT_READ_TOKEN },
    signal: AbortSignal.timeout(5000),
    redirect: 'error',
  });
  if (!response.ok) throw Error('Archive unavailable');
  return response.json();
}
export async function archivedAudit(q: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const key of [
    'memberId',
    'author',
    'kind',
    'q',
    'actor',
    'sort',
    'order',
    'page',
    'pageSize',
  ])
    if (typeof q[key] === 'string') params.set(key, q[key] as string);
  if (typeof q.from === 'string' && q.from)
    params.set('from', startOfOrganizationDay(q.from).toISOString());
  if (typeof q.to === 'string' && q.to)
    params.set(
      'to',
      startOfOrganizationDay(
        new Date(Date.parse(q.to + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10),
      ).toISOString(),
    );
  const data = (await vaultRequest('/audit?' + params)) as {
    rows: (OperationsAudit & {
      memberName: string;
      archivedAt: string;
      archiveHash: string;
      archiveSequence: number;
    })[];
    total: number;
  };
  if (!data || !Array.isArray(data.rows) || typeof data.total !== 'number')
    throw Error('Invalid archive response');
  const delivery = await AppDataSource.manager.findOneBy(BackupRuntime, { id: 'audit-vault' });
  const state = delivery ? JSON.parse(delivery.detail) : {};
  return {
    ...data,
    rows: data.rows.map((row: any) => ({
      ...auditDetail(row),
      memberName: row.memberName,
      archivedAt: row.archivedAt,
      archiveHash: row.archiveHash,
      archiveSequence: row.archiveSequence,
    })),
    archive: {
      source: 'vault',
      timezone: organizationTimeZone,
      pending: state.pending ?? null,
      lastSyncedAt: state.lastSyncedAt || null,
      deliveryHealthy:
        !!delivery &&
        Date.now() - new Date(delivery.heartbeat).getTime() < 180000 &&
        state.ok === true,
    },
  };
}
