import { AppDataSource } from '../database';
import { HealthSample } from '../entity/healthSample';
import { localConfig } from '../dev/config';
import { collectHealth, HealthCheck, HealthSnapshot } from './health';
import { refreshOrganizationSettings } from '../organization/settings';

type HistoricalCheck = HealthCheck & { min?: number; max?: number; at: string };
type Bucket = {
  firstAt: string;
  lastAt: string;
  count: number;
  gap?: boolean;
  checks: HistoricalCheck[];
};
const severity = { ok: 0, unknown: 1, warning: 2, critical: 3 };
export function mergeHealthBucket(previous: Bucket | undefined, snapshot: HealthSnapshot): Bucket {
  if (previous && snapshot.checkedAt <= previous.lastAt) return previous;
  const checks = snapshot.checks.map((check) => {
    const old = previous?.checks.find((c) => c.name === check.name);
    const worst =
      old && severity[old.status] > severity[check.status]
        ? old
        : { ...check, at: snapshot.checkedAt };
    const values = [old?.min, old?.max, check.value].filter(
      (n): n is number => typeof n === 'number' && Number.isFinite(n),
    );
    return {
      ...worst,
      ...(values.length
        ? {
            min: Math.min(...values),
            max: Math.max(...values),
            value: Math.max(...values),
            unit: check.unit || old?.unit,
          }
        : {}),
    };
  });
  return {
    firstAt: previous?.firstAt || snapshot.checkedAt,
    lastAt: snapshot.checkedAt,
    count: (previous?.count || 0) + 1,
    gap:
      !!previous &&
      (!!previous.gap || Date.parse(snapshot.checkedAt) - Date.parse(previous.lastAt) > 450000),
    checks,
  };
}
export async function persistHealth(snapshot: HealthSnapshot) {
  if (snapshot.demo || localConfig.runtimeMode === 'hosted-demo') return;
  const at = Date.parse(snapshot.checkedAt);
  if (!Number.isFinite(at)) throw Error('Invalid health sample timestamp.');
  for (const [resolution, milliseconds] of [
    ['5m', 300000],
    ['1h', 3600000],
  ] as const) {
    const start = new Date(Math.floor(at / milliseconds) * milliseconds),
      id = resolution + ':' + start.toISOString();
    await AppDataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(HealthSample)
        .values({ id, resolution, startedAt: start, payload: 'null' })
        .orIgnore()
        .execute();
      const row = await manager.findOneOrFail(HealthSample, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      row.payload = JSON.stringify(
        mergeHealthBucket(JSON.parse(row.payload) || undefined, snapshot),
      );
      await manager.save(row);
    });
  }
  await AppDataSource.createQueryBuilder()
    .delete()
    .from(HealthSample)
    .where('(resolution=:short AND startedAt<:week) OR startedAt<:quarter', {
      short: '5m',
      week: new Date(at - 7 * 86400000),
      quarter: new Date(at - 90 * 86400000),
    })
    .execute();
}
export async function healthHistory(range = '24h', now = new Date()) {
  const days = ({ '24h': 1, '7d': 7, '30d': 30, '90d': 90 } as Record<string, number>)[range] || 1;
  const resolution = days <= 7 ? '5m' : '1h',
    intervalSeconds = days <= 7 ? 300 : 3600;
  const from = new Date(+now - days * 86400000).toISOString(),
    to = now.toISOString();
  if (localConfig.runtimeMode === 'hosted-demo') return { from, to, intervalSeconds, points: [] };
  const rows = await AppDataSource.getRepository(HealthSample)
    .createQueryBuilder('sample')
    .where('sample.resolution=:resolution AND sample.startedAt>=:from AND sample.startedAt<=:to', {
      resolution,
      from: new Date(from),
      to: now,
    })
    .orderBy('sample.startedAt', 'ASC')
    .take(2200)
    .getMany();
  const displayInterval = Math.max(
    intervalSeconds,
    Math.ceil(
      (rows.length ? (+rows[rows.length - 1].startedAt - +rows[0].startedAt) / 1000 : 0) /
        360 /
        intervalSeconds,
    ) * intervalSeconds,
  );
  const groups = new Map<number, Bucket>();
  for (const row of rows) {
    const at = Math.floor(+row.startedAt / (displayInterval * 1000)) * displayInterval * 1000;
    const bucket = JSON.parse(row.payload) as Bucket,
      old = groups.get(at);
    if (!old) {
      groups.set(at, bucket);
      continue;
    }
    const checks = [...new Set([...old.checks, ...bucket.checks].map((c) => c.name))].map(
      (name) => {
        const a = old.checks.find((c) => c.name === name),
          b = bucket.checks.find((c) => c.name === name);
        if (!a) return b!;
        if (!b) return a;
        const worst = severity[a.status] > severity[b.status] ? a : b;
        const values = [a.min, a.max, b.min, b.max].filter(
          (v): v is number => typeof v === 'number',
        );
        return {
          ...worst,
          ...(values.length
            ? { min: Math.min(...values), max: Math.max(...values), value: Math.max(...values) }
            : {}),
        };
      },
    );
    groups.set(at, {
      firstAt: old.firstAt,
      lastAt: bucket.lastAt,
      count: old.count + bucket.count,
      gap:
        !!old.gap || !!bucket.gap || Date.parse(bucket.firstAt) - Date.parse(old.lastAt) > 450000,
      checks,
    });
  }
  return {
    from,
    to,
    intervalSeconds: displayInterval,
    points: [...groups].map(([at, bucket]) => ({ at: new Date(at).toISOString(), ...bucket })),
  };
}
export function startHealthHistory() {
  if (localConfig.runtimeMode === 'hosted-demo') return () => {};
  let busy = false;
  const sample = async () => {
    if (busy) return;
    busy = true;
    try {
      await refreshOrganizationSettings();
      await persistHealth(await collectHealth());
    } catch {
      console.error('Health history sample could not be retained.');
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void sample(), 300000);
  timer.unref();
  void sample();
  return () => clearInterval(timer);
}
