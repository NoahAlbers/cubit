import os from 'node:os';
import { statfs } from 'node:fs/promises';
import { AppDataSource } from '../database';
import { localConfig } from '../dev/config';
import { BackupRuntime, BackupJob } from '../entity/backup';

type Check = { name: string; status: 'ok' | 'warning' | 'critical' | 'unknown'; detail: string };
export function capacityStatus(used: number): Check['status'] {
  return used >= 95 ? 'critical' : used >= 85 ? 'warning' : 'ok';
}
let cached: { until: number; value: unknown } | undefined;
let pending: Promise<unknown> | undefined;
export function invalidateHealth() {
  cached = undefined;
}
async function collect() {
  const checkedAt = new Date().toISOString();
  if (localConfig.runtimeMode === 'hosted-demo')
    return {
      checkedAt,
      demo: true,
      checks: [],
      message: 'Real server diagnostics are hidden in the synthetic demo.',
    };
  const checks: Check[] = [];
  const add = (name: string, status: Check['status'], detail: string) =>
    checks.push({ name, status, detail });
  const gb = (n: number) => (n / 1073741824).toFixed(1) + ' GB';
  const seconds = Math.round(process.uptime());
  add(
    'Application',
    'ok',
    `Running for ${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m · Node ${process.versions.node}`,
  );
  try {
    const disk = await statfs(process.cwd());
    const total = disk.blocks * disk.bsize,
      free = disk.bavail * disk.bsize;
    const used = total ? (1 - free / total) * 100 : 0;
    add(
      'Server storage',
      capacityStatus(used),
      `${gb(free)} available of ${gb(total)} · ${used.toFixed(1)}% used. Warning at 85%; critical at 95%.`,
    );
  } catch {
    add('Server storage', 'unknown', 'Storage readings are unavailable to the application.');
  }
  const totalMemory = os.totalmem(),
    freeMemory = os.freemem();
  add(
    'Server memory',
    capacityStatus((1 - freeMemory / totalMemory) * 100),
    `${gb(freeMemory)} free of ${gb(totalMemory)}. File-system cache may be reclaimable.`,
  );
  add(
    'Application memory',
    'ok',
    `${gb(process.memoryUsage().rss)} resident memory · ${gb(process.memoryUsage().heapUsed)} JavaScript heap used.`,
  );
  const load = os.loadavg()[0],
    cpus = os.availableParallelism();
  add(
    'CPU load',
    process.platform === 'win32' ? 'unknown' : load > cpus * 2 ? 'warning' : 'ok',
    process.platform === 'win32'
      ? 'Load average is unavailable on Windows.'
      : `${load.toFixed(2)} one-minute load across ${cpus} available CPU cores.`,
  );
  const started = Date.now();
  try {
    await AppDataSource.query('SELECT 1');
    add('Database', 'ok', `Read check completed in ${Date.now() - started} ms.`);
  } catch {
    add(
      'Database',
      'critical',
      'Database read failed. Ask the operator to check the database service.',
    );
  }
  try {
    const runtime = await AppDataSource.manager.findOneBy(BackupRuntime, { id: 'default' });
    const latest = await AppDataSource.manager.findOne(BackupJob, {
      where: { kind: 'backup', status: 'Succeeded' },
      order: { finishedAt: 'DESC' },
    });
    const failed = await AppDataSource.manager
      .createQueryBuilder(BackupJob, 'job')
      .where("job.status='Failed' AND job.reviewedAt IS NULL AND job.createdAt >= :since", {
        since: new Date(Date.now() - 7 * 86400000),
      })
      .getCount();
    const state = runtime ? JSON.parse(runtime.detail) : {};
    const fresh = !!runtime && Date.now() - new Date(runtime.heartbeat).getTime() < 180000;
    add(
      'Backup worker',
      fresh ? 'ok' : 'warning',
      runtime
        ? `Last heartbeat: ${new Date(runtime.heartbeat).toISOString()}.`
        : 'No worker heartbeat received. Local development does not run the VPS backup worker.',
    );
    add(
      'Last successful backup',
      latest ? 'ok' : 'warning',
      latest?.finishedAt
        ? new Date(latest.finishedAt).toISOString()
        : 'No successful scheduled/manual backup recorded.',
    );
    add(
      'Recent backup failures',
      failed ? 'warning' : 'ok',
      `${failed} unreviewed failed backup/recovery jobs in the last seven days. Reviewed failures stay in Backups & recovery history.`,
    );
    add(
      'Off-server recovery',
      state.offsiteConfigured ? 'ok' : 'warning',
      state.offsiteConfigured
        ? 'Off-server destination configured; verify successful copies and restoration in Backups & recovery.'
        : 'No off-server destination configured. Local backups do not protect against losing this VPS.',
    );
    const https = state.https,
      recentHttps = https?.checkedAt && Date.now() - Date.parse(https.checkedAt) < 7200000;
    add(
      'Public HTTPS & network',
      fresh && recentHttps ? (https.ok ? 'ok' : 'critical') : 'unknown',
      recentHttps
        ? `${https.ok ? 'Trusted HTTPS and HTTP redirect verified.' : 'HTTPS or redirect check failed.'} Checked ${https.checkedAt}.`
        : 'No recent public HTTPS check. This probe covers DNS, outbound connectivity to this hostname, TLS, and the public health endpoint; it does not prove every client can connect.',
    );
    add(
      'Recovery test',
      state.lastVerifiedAt ? 'ok' : 'warning',
      state.lastVerifiedAt
        ? `Last isolated restore: ${state.lastVerifiedAt}.`
        : 'No successful isolated recovery test recorded.',
    );
  } catch {
    add(
      'Backup & network diagnostics',
      'unknown',
      'Diagnostics could not be read. Refresh or ask the operator to inspect worker logs.',
    );
  }
  return {
    checkedAt,
    demo: false,
    checks,
    refreshSeconds: 30,
    message:
      'Read-only snapshot. Refresh to check again; this page does not send alerts or replace independent uptime monitoring.',
  };
}
export async function systemHealth() {
  // Never reuse a real-server snapshot in the public demo.
  if (localConfig.runtimeMode === 'hosted-demo') return collect();
  if (cached && cached.until > Date.now()) return cached.value;
  if (!pending)
    pending = collect()
      .then((value) => {
        cached = { value, until: Date.now() + 30000 };
        return value;
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
