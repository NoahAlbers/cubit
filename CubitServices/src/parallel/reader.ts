import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { localConfig } from '../dev/config';

let pool: Pool | undefined;
export const parallelEnabled = () =>
  process.env.PARALLEL_ENABLED === 'true' && localConfig.runtimeMode !== 'hosted-demo';
function readerPool() {
  if (!parallelEnabled())
    throw Object.assign(Error('Parallel workspace is not enabled.'), { status: 503 });
  if (!pool) {
    if (!process.env.PARALLEL_READER_PASSWORD) throw Error('Parallel reader is not configured');
    pool = mysql.createPool({
      host: '127.0.0.1',
      port: Number(process.env.PARALLEL_DATABASE_PORT || 3306),
      database: 'cubit_parallel',
      user: 'cubit_parallel_reader',
      password: process.env.PARALLEL_READER_PASSWORD,
      dateStrings: true,
      connectionLimit: 3,
      connectTimeout: 5000,
    });
  }
  return pool;
}
export const json = (value: any) => (typeof value === 'string' ? JSON.parse(value) : value);
export async function readParallel<T>(action: (db: PoolConnection, generation: any) => Promise<T>) {
  const db = await readerPool().getConnection();
  try {
    await db.query('SET SESSION MAX_EXECUTION_TIME=4000');
    await db.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [rows] = await db.query<any[]>(
      'SELECT g.* FROM parallel_current c JOIN parallel_generation g ON g.id=c.generation WHERE c.id=1',
    );
    const generation = rows[0];
    const result = await action(db, generation);
    await db.rollback();
    return result;
  } finally {
    await db.rollback().catch(() => {});
    db.release();
  }
}
export function generationStatus(g: any) {
  if (!g) return { ready: false, readOnly: true };
  const sourceTime = String(g.sourceTime).replace(' ', 'T') + 'Z';
  return {
    ready: true,
    readOnly: true,
    id: g.id,
    sourceTime,
    importedAt: String(g.importedAt).replace(' ', 'T') + 'Z',
    stale: Date.now() - Date.parse(sourceTime) > 30 * 60000,
    counts: json(g.counts),
    changes: json(g.changes),
  };
}
export async function parallelMember(id: string) {
  return readParallel(async (db, g) => {
    if (!g) throw Object.assign(Error('No snapshot is available yet.'), { status: 503 });
    const [rows] = await db.query<any[]>(
      "SELECT payload FROM parallel_record WHERE generation=? AND kind='member' AND sourceId=?",
      [g.id, id],
    );
    if (!rows[0])
      throw Object.assign(Error('Member not present in this snapshot.'), { status: 404 });
    const [related] = await db.query<any[]>(
      "SELECT kind,payload FROM parallel_record WHERE generation=? AND memberId=? AND kind IN ('member_plan','member_key','transaction') ORDER BY dateValue DESC,sourceId",
      [g.id, id],
    );
    const [plans] = await db.query<any[]>(
      "SELECT payload FROM parallel_record WHERE generation=? AND kind='plan'",
      [g.id],
    );
    const [events] = await db.query<any[]>(
      "SELECT payload FROM parallel_record WHERE generation=? AND kind='access_log' AND memberId=? ORDER BY dateValue DESC,sourceId LIMIT 100",
      [g.id, id],
    );
    const byKind = (kind: string) =>
      related.filter((r) => r.kind === kind).map((r) => json(r.payload));
    const catalog = plans.map((r) => json(r.payload));
    return {
      snapshot: generationStatus(g),
      member: json(rows[0].payload),
      memberships: byKind('member_plan').map((p) => ({
        ...p,
        plan: catalog.find((c) => c.id === p.planId),
      })),
      keys: byKind('member_key'),
      payments: byKind('transaction'),
      events: events.map((r) => json(r.payload)),
    };
  });
}
