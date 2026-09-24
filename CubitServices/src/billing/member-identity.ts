import { EntityManager } from 'typeorm';
import { Member } from '../entity/member';
import { OperationsSettings } from '../entity/cubitOperations';
import { fail } from './payments';

export async function lockIdentities(manager: EntityManager) {
  await manager.findOneOrFail(OperationsSettings, {
    where: { id: 'default' },
    lock: { mode: 'pessimistic_write' },
  });
}
export async function rejectDuplicateContact(manager: EntityManager, email: string, exceptId = '') {
  const count = await manager
    .createQueryBuilder(Member, 'm')
    .where(
      "LOWER(REGEXP_REPLACE(m.email, '^[[:space:]]+|[[:space:]]+$', '')) = :email AND m.id != :id",
      { email: email.trim().toLowerCase(), id: exceptId },
    )
    .getCount();
  if (count)
    fail(
      'A member already uses this contact email. Match or edit the existing member instead.',
      409,
    );
}
