import { authorizeAccountChange, isStaffRole } from './staff-permissions';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { compare, hash } from 'bcrypt';
import { TOTP, Secret } from 'otpauth';
import { EntityManager } from 'typeorm';
import { AccountLink, AccountMfa } from '../entity/accountSecurity';
import { Member } from '../entity/member';
import { AppDataSource } from '../database';
import { localConfig } from '../dev/config';
import { demoMemberId } from '../demo/identity';
import { lockIdentities } from '../billing/member-identity';
import { recordAudit } from '../staff/audit';
import { validateNewPassword } from './password-policy';
import { reserveMfaAttempt, clearMfaAttempts } from './mfa-throttle';

const fail = (message: string, status = 400): never => {
  throw Object.assign(Error(message), { status });
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const mfaConfigured = () => /^[a-f0-9]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY || '');
function encryptionKey() {
  if (!mfaConfigured()) fail('Authenticator setup is not configured by the operator.', 503);
  return Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex');
}
export function encryptSecret(secret: string, memberId: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(memberId));
  return Buffer.concat([
    iv,
    cipher.update(secret, 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString('base64');
}
export function decryptSecret(secret: string, memberId: string) {
  const bytes = Buffer.from(secret, 'base64');
  if (bytes.length < 29) throw Error('Invalid encrypted authenticator secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(memberId));
  decipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString(
    'utf8',
  );
}
function totp(secret: string, email = '') {
  return new TOTP({
    issuer: 'Cubit',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
}
function editable(member: Member) {
  if (localConfig.runtimeMode === 'hosted-demo' && member.id === demoMemberId)
    fail('The shared demo sign-in cannot be changed.', 403);
  if (member.loginDisabled) fail('This account cannot sign in. Contact the operator.', 403);
}
async function lockAccount(manager: EntityManager, id: string) {
  return manager.findOneOrFail(Member, { where: { id }, lock: { mode: 'pessimistic_write' } });
}
async function uniqueLogin(manager: EntityManager, member: Member) {
  const count = await manager
    .createQueryBuilder(Member, 'm')
    .where("LOWER(REGEXP_REPLACE(m.email, '^[[:space:]]+|[[:space:]]+$', '')) = :email", {
      email: member.email.trim().toLowerCase(),
    })
    .getCount();
  if (count !== 1) fail('Resolve the duplicate login email before providing account access.', 409);
}
async function reauthenticate(manager: EntityManager, member: Member, password: unknown) {
  if (
    typeof password !== 'string' ||
    password.length > 1024 ||
    !/^\$2[aby]\$/.test(member.password) ||
    !(await compare(password, member.password))
  )
    fail('Check your current password.', 401);
  await uniqueLogin(manager, member);
}

// Call with the member locked; consuming a step or recovery code is transactional.
export async function verifyMfa(
  manager: EntityManager,
  member: Member,
  code: unknown,
  required = false,
) {
  const settings = await manager.findOneBy(AccountMfa, { memberId: member.id });
  if (!settings?.secret) {
    if (required) fail('Staff must enroll an authenticator before signing in.', 403);
    return false;
  }
  if (typeof code !== 'string' || !code.trim())
    throw Object.assign(Error('Enter an authenticator or recovery code.'), {
      status: 401,
      code: 'MFA_REQUIRED',
    });
  const input = code.trim();
  const reservation = await reserveMfaAttempt(member.id);
  let accepted = false;
  if (/^\d{6}$/.test(input)) {
    const now = Date.now(),
      delta = totp(decryptSecret(settings.secret, member.id)).validate({
        token: input,
        window: 1,
        timestamp: now,
      });
    const step = delta === null ? -1 : Math.floor(now / 30000) + delta;
    if (step > Number(settings.lastStep)) {
      settings.lastStep = String(step);
      accepted = true;
    }
  } else if (/^[a-f0-9]{8}(?:-[a-f0-9]{8}){3}$/i.test(input)) {
    const hashes: string[] = JSON.parse(settings.recoveryHashes || '[]'),
      candidate = digest(input.toLowerCase());
    const index = hashes.findIndex((value) =>
      timingSafeEqual(Buffer.from(value, 'hex'), Buffer.from(candidate, 'hex')),
    );
    if (index >= 0) {
      hashes.splice(index, 1);
      settings.recoveryHashes = JSON.stringify(hashes);
      accepted = true;
    }
  }
  if (!accepted)
    fail('That authenticator or recovery code is invalid or has already been used.', 401);
  await manager.save(AccountMfa, settings);
  await clearMfaAttempts(manager, reservation);
  return true;
}

export async function authenticateSecondFactor(member: Member, code: unknown) {
  return AppDataSource.transaction(async (manager) => {
    const current = await lockAccount(manager, member.id);
    if (current.tokenVersion !== member.tokenVersion || current.loginDisabled)
      fail('Please sign in again.', 401);
    const mfaVerified = await verifyMfa(
      manager,
      current,
      code,
      isStaffRole(current.role) && process.env.REQUIRE_STAFF_MFA === 'true',
    );
    return Object.assign(current, { mfaVerified });
  });
}

export async function issueAccountLink(memberId: string, actor: Member, purpose: unknown) {
  if (purpose !== 'invite' && purpose !== 'reset') fail('Choose an invitation or password reset.');
  return AppDataSource.transaction(async (manager) => {
    await lockIdentities(manager);
    const member = await lockAccount(manager, memberId);
    await authorizeAccountChange(manager, actor, member);
    editable(member);
    await uniqueLogin(manager, member);
    if (purpose === 'invite' && /^\$2[aby]\$/.test(member.password))
      fail('This account already has a password. Use a reset link.');
    const token =
      (localConfig.runtimeMode === 'hosted-demo' ? 'd.' : 'r.') +
      randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await manager.delete(AccountLink, { memberId });
    await manager.save(AccountLink, {
      tokenHash: digest(token),
      memberId,
      purpose: purpose as string,
      email: member.email,
      tokenVersion: member.tokenVersion,
      expiresAt,
      usedAt: null,
    });
    await recordAudit(manager, {
      memberId,
      kind: purpose === 'invite' ? 'Account invitation prepared' : 'Password reset prepared',
      author: actor.email,
      entityId: memberId,
      after: { expiresAt: expiresAt.toISOString(), delivery: 'Staff shares link manually' },
    });
    return {
      path: '/account/activate#token=' + encodeURIComponent(token),
      expiresAt,
      email: member.email,
    };
  });
}

export async function redeemAccountLink(token: unknown, password: unknown, code: unknown) {
  if (typeof token !== 'string' || !/^[dr]\.[A-Za-z0-9_-]{43}$/.test(token))
    fail('This link is invalid or expired.');
  if ((token as string).startsWith('d.') !== (localConfig.runtimeMode === 'hosted-demo'))
    fail('This link is invalid or expired.');
  validateNewPassword(password);
  const encrypted = await hash(password, 12),
    tokenHash = digest(token as string);
  await AppDataSource.transaction(async (manager) => {
    await lockIdentities(manager);
    const link = await manager.findOne(AccountLink, {
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
    if (!link || link.usedAt || link.expiresAt.getTime() <= Date.now())
      fail('This link is invalid or expired.');
    const active = link!,
      member = await lockAccount(manager, active.memberId);
    editable(member);
    await uniqueLogin(manager, member);
    if (member.email !== active.email || member.tokenVersion !== active.tokenVersion)
      fail('This link is invalid or expired.');
    // A password reset never removes or bypasses an enrolled second factor.
    await verifyMfa(manager, member, code);
    await manager.update(Member, member.id, {
      password: encrypted,
      tokenVersion: member.tokenVersion + 1,
    });
    await manager.update(AccountLink, tokenHash, { usedAt: new Date() });
    await recordAudit(manager, {
      memberId: member.id,
      kind: 'Member password changed',
      author: member.email,
      actorType: 'member',
      entityId: member.id,
      after: { passwordChanged: true, method: active.purpose },
    });
  });
}

export async function beginMfa(memberId: string, password: unknown) {
  return AppDataSource.transaction(async (manager) => {
    const member = await lockAccount(manager, memberId);
    editable(member);
    await reauthenticate(manager, member, password);
    if (!isStaffRole(member.role))
      fail('Authenticator enrollment is currently available to staff accounts.', 403);
    const existing = await manager.findOneBy(AccountMfa, { memberId });
    if (existing?.secret) fail('An authenticator is already enrolled.');
    const secret = new Secret({ size: 20 }).base32;
    await manager.save(AccountMfa, {
      memberId,
      pendingSecret: encryptSecret(secret, memberId),
      pendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return { secret, uri: totp(secret, member.email).toString() };
  });
}
export async function confirmMfa(memberId: string, password: unknown, code: unknown) {
  return AppDataSource.transaction(async (manager) => {
    const member = await lockAccount(manager, memberId);
    editable(member);
    await reauthenticate(manager, member, password);
    const settings = await manager.findOneBy(AccountMfa, { memberId });
    if (
      !settings?.pendingSecret ||
      !settings.pendingExpiresAt ||
      settings.pendingExpiresAt.getTime() <= Date.now() ||
      settings.secret
    )
      fail('Restart authenticator setup.');
    const current = settings!,
      now = Date.now(),
      secret = decryptSecret(current.pendingSecret!, memberId);
    const reservation = await reserveMfaAttempt(memberId);
    const delta =
      typeof code === 'string' && /^\d{6}$/.test(code)
        ? totp(secret).validate({ token: code, window: 1, timestamp: now })
        : null;
    if (delta === null) fail('Enter the current six-digit code from your authenticator app.', 401);
    const recoveryCodes = Array.from({ length: 10 }, () =>
      randomBytes(16).toString('hex').match(/.{8}/g)!.join('-'),
    );
    await manager.update(AccountMfa, memberId, {
      secret: current.pendingSecret,
      pendingSecret: null,
      pendingExpiresAt: null,
      lastStep: String(Math.floor(now / 30000) + delta!),
      recoveryHashes: JSON.stringify(recoveryCodes.map(digest)),
    });
    await manager.increment(Member, { id: memberId }, 'tokenVersion', 1);
    await clearMfaAttempts(manager, reservation);
    await recordAudit(manager, {
      memberId,
      kind: 'Authenticator enabled',
      author: member.email,
      actorType: 'staff',
      entityId: memberId,
      after: { mfaEnabled: true },
    });
    return { recoveryCodes };
  });
}
