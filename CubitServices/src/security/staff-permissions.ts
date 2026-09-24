import { EntityManager } from 'typeorm';
import { Member, ROLES } from '../entity/member';
import { localConfig } from '../dev/config';
import { demoMemberId } from '../demo/identity';

export const isStaffRole = (role: unknown) => role === ROLES.ADMIN || role === ROLES.STAFF;
function reject(message: string, status = 403): never {
  throw Object.assign(Error(message), { status });
}

// Call under the shared identity lock for account edits. The actor is read again
// so a demotion that happened while this request waited cannot grant privileges.
export async function authorizeAccountChange(
  manager: EntityManager,
  actor: Member,
  target: Member,
  patch: Partial<Member> = {},
) {
  const currentActor = await manager.findOneBy(Member, { id: actor.id });
  if (
    !currentActor ||
    currentActor.loginDisabled ||
    currentActor.tokenVersion !== actor.tokenVersion ||
    !isStaffRole(currentActor.role)
  )
    reject('Your account changed. Sign in again.', 401);
  const nextRole = patch.role ?? target.role;
  if (currentActor.role !== ROLES.ADMIN && (isStaffRole(target.role) || nextRole !== target.role))
    reject('Only Administration can manage staff accounts or change roles.');
  if (localConfig.runtimeMode === 'hosted-demo' && target.id === demoMemberId)
    reject('The shared demo staff account cannot be changed.');
  if (
    target.role === ROLES.ADMIN &&
    !target.loginDisabled &&
    (nextRole !== ROLES.ADMIN || patch.loginDisabled === true)
  ) {
    if (target.id === actor.id)
      reject('Another administrator must change your administrative access.', 409);
    const remaining = await manager.countBy(Member, { role: ROLES.ADMIN, loginDisabled: false });
    if (remaining <= 1) reject('Keep at least one enabled Administration account.', 409);
  }
}
