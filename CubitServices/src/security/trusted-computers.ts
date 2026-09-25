import { createHash, randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import { EntityManager, MoreThan } from 'typeorm';
import { TrustedComputer } from '../entity/trustedComputer';
import { AccountMfa } from '../entity/accountSecurity';
import { Member } from '../entity/member';
import { AppDataSource } from '../database';
import { localConfig } from '../dev/config';
import { jwtHelper } from '../api/common/jwtHelper';
import { recordAudit } from '../staff/audit';
import { demoMemberId } from '../demo/identity';

export const TRUST_LIFETIME = 30 * 86400000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fail = (message: string, status = 403): never => {
  throw Object.assign(Error(message), { status });
};
export function trustCookieName() {
  return (
    (localConfig.runtimeMode === 'local' ? '' : '__Host-') +
    'cubit-trust-' +
    digest(localConfig.runtimeMode + ':' + localConfig.database).slice(0, 12)
  );
}
const cookieOptions = () => ({
  httpOnly: true,
  secure: localConfig.runtimeMode !== 'local',
  sameSite: 'strict' as const,
  path: '/',
});
export function trustCookie(req: Request) {
  const name = trustCookieName();
  const value = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + '='))
    ?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
// Only call after a successful password check and while holding the account lock.
export async function verifyTrustedComputer(
  manager: EntityManager,
  member: Member,
  token?: string,
) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const row = await manager.findOneBy(TrustedComputer, {
    tokenHash: digest(token),
    memberId: member.id,
    tokenVersion: member.tokenVersion,
    expiresAt: MoreThan(new Date()),
  });
  if (!row) return false;
  const mfa = await manager.findOneBy(AccountMfa, { memberId: member.id });
  if (!mfa?.secret) return false;
  await manager.update(TrustedComputer, row.tokenHash, { lastUsedAt: new Date() });
  return true; // Absolute expiry is never extended by use.
}
export async function rememberComputer(req: Request, res: Response) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  const claims = jwtHelper.ValidateJWT(bearer);
  const now = Date.now();
  if (
    claims.mfaFresh !== true ||
    typeof claims.mfaProof !== 'string' ||
    !Number.isSafeInteger(claims.iat) ||
    claims.iat * 1000 > now ||
    now - claims.iat * 1000 > 300000
  )
    fail('Sign in with your authenticator again before trusting this computer.');
  const token = randomBytes(32).toString('base64url'),
    expiresAt = new Date(now + TRUST_LIFETIME);
  await AppDataSource.transaction(async (manager) => {
    const member = await manager.findOneOrFail(Member, {
      where: { id: req.member!.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !jwtHelper.sessionMatches(claims, member) ||
      (localConfig.runtimeMode === 'hosted-demo' && member.id === demoMemberId)
    )
      fail('Please sign in again.');
    const mfa = await manager.findOneBy(AccountMfa, { memberId: member.id });
    if (!mfa?.secret) fail('An enrolled authenticator is required.');
    const proofHash = digest(claims.mfaProof);
    if (await manager.existsBy(TrustedComputer, { proofHash }))
      fail('This sign-in has already been used to trust a computer.', 409);
    // Remove this account's expired/version-invalid rows; cap active trust at ten browsers.
    await manager
      .createQueryBuilder()
      .delete()
      .from(TrustedComputer)
      .where('memberId = :id AND (expiresAt <= :now OR tokenVersion != :version)', {
        id: member.id,
        now: new Date(),
        version: member.tokenVersion,
      })
      .execute();
    if ((await manager.countBy(TrustedComputer, { memberId: member.id })) >= 10)
      fail(
        'Ten computers are already trusted. Forget trusted computers in account settings first.',
        409,
      );
    await manager.save(TrustedComputer, {
      tokenHash: digest(token),
      proofHash,
      memberId: member.id,
      tokenVersion: member.tokenVersion,
      createdAt: new Date(now),
      expiresAt,
      lastUsedAt: null,
    });
    await recordAudit(manager, {
      memberId: member.id,
      kind: 'Computer trusted for MFA',
      author: member.email,
      entityId: member.id,
      after: { expiresAt: expiresAt.toISOString() },
    });
  });
  res.cookie(trustCookieName(), token, { ...cookieOptions(), maxAge: TRUST_LIFETIME });
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ expiresAt });
}
export async function trustedComputerSummary(member: Member) {
  const rows = await AppDataSource.manager.find(TrustedComputer, {
    where: {
      memberId: member.id,
      tokenVersion: member.tokenVersion,
      expiresAt: MoreThan(new Date()),
    },
    order: { createdAt: 'DESC' },
    take: 10,
    select: { createdAt: true, expiresAt: true, lastUsedAt: true },
  });
  return rows;
}
export async function forgetComputers(req: Request, res: Response) {
  await AppDataSource.transaction(async (manager) => {
    const member = await manager.findOneOrFail(Member, {
      where: { id: req.member!.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (member.tokenVersion !== req.member!.tokenVersion) fail('Please sign in again.', 401);
    await manager.delete(TrustedComputer, { memberId: member.id });
    await manager.increment(Member, { id: member.id }, 'tokenVersion', 1);
    await recordAudit(manager, {
      memberId: member.id,
      kind: 'Trusted computers revoked',
      author: member.email,
      entityId: member.id,
      after: { allComputersRevoked: true, allSessionsRevoked: true },
    });
  });
  res.clearCookie(trustCookieName(), cookieOptions());
  res.status(204).end();
}
