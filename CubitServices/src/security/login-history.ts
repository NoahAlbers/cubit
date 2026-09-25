import { Request } from 'express';
import { open, Reader, CityResponse } from 'maxmind';
import { AppDataSource } from '../database';
import { LoginHistory } from '../entity/loginHistory';
import { Member } from '../entity/member';
import { localConfig } from '../dev/config';
import { requestDevice } from './device';

let reader: Promise<Reader<CityResponse> | null> | undefined;
export function startLoginHistoryRetention() {
  let busy = false;
  const clean = async () => {
    if (busy) return;
    busy = true;
    try {
      await AppDataSource.createQueryBuilder()
        .delete()
        .from(LoginHistory)
        .where('createdAt < :cutoff', { cutoff: new Date(Date.now() - 180 * 86400000) })
        .execute();
    } catch {
      console.error('Login-history retention cleanup failed.');
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void clean(), 3600000);
  timer.unref();
  void clean();
  return () => clearInterval(timer);
}
export async function approximateLocation(ip: string | null) {
  if (!ip || !process.env.GEOIP_DATABASE_PATH || localConfig.runtimeMode === 'hosted-demo')
    return null;
  // An operator-managed local MMDB file: no sign-in IP is sent to a lookup service.
  reader ||= open<CityResponse>(process.env.GEOIP_DATABASE_PATH).catch(() => null);
  try {
    const match = (await reader)?.get(ip);
    return (
      [match?.city?.names?.en, match?.subdivisions?.[0]?.names?.en, match?.country?.names?.en]
        .filter(Boolean)
        .join(', ')
        .slice(0, 255) || null
    );
  } catch {
    return null;
  }
}
export async function recordLogin(
  req: Request,
  member: Member,
  mfaVerified: boolean,
  mfaFresh: boolean,
) {
  // The public shared workspace does not retain visitor login histories.
  if (localConfig.runtimeMode === 'hosted-demo') return;
  const device = requestDevice(req),
    location = await approximateLocation(device.ip);
  await AppDataSource.transaction(async (manager) => {
    const current = await manager.findOneOrFail(Member, {
      where: { id: member.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (current.loginDisabled || current.tokenVersion !== member.tokenVersion)
      throw Object.assign(Error('Please sign in again.'), { status: 401 });
    await manager.save(LoginHistory, {
      memberId: member.id,
      createdAt: new Date(),
      method: mfaFresh
        ? 'Authenticator / recovery code'
        : mfaVerified
          ? 'Trusted computer'
          : 'Password',
      deviceDetails: JSON.stringify(device),
      location,
    });
    // Bound both age and volume. Locking the account serializes simultaneous logins.
    await manager
      .createQueryBuilder()
      .delete()
      .from(LoginHistory)
      .where('memberId = :id AND createdAt < :cutoff', {
        id: member.id,
        cutoff: new Date(Date.now() - 180 * 86400000),
      })
      .execute();
    const overflow = await manager.find(LoginHistory, {
      where: { memberId: member.id },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 500,
      take: 100,
      select: { id: true },
    });
    if (overflow.length)
      await manager.delete(
        LoginHistory,
        overflow.map((row) => row.id),
      );
  });
}
export async function loginHistory(memberId: string, page: number) {
  if (localConfig.runtimeMode === 'hosted-demo')
    return { rows: [], total: 0, page: 1, pageSize: 10, privateDemo: true };
  const query = AppDataSource.getRepository(LoginHistory)
    .createQueryBuilder('login')
    .where('login.memberId = :id AND login.createdAt >= :cutoff', {
      id: memberId,
      cutoff: new Date(Date.now() - 180 * 86400000),
    });
  const total = await query.getCount();
  page = Math.min(page, Math.max(1, Math.ceil(total / 10)));
  const rows = await query
    .orderBy('login.createdAt', 'DESC')
    .addOrderBy('login.id', 'DESC')
    .skip((page - 1) * 10)
    .take(10)
    .getMany();
  return {
    rows: rows.map(({ memberId: _memberId, deviceDetails, ...row }) => ({
      ...row,
      device: JSON.parse(deviceDetails),
    })),
    total,
    page,
    pageSize: 10,
  };
}
