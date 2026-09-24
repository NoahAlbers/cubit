import { recordAudit, snapshot, paymentFields } from '../staff/audit';
import { EntityManager } from 'typeorm';
import { Transaction } from '../entity/transaction';
import { validDay, day } from './ledger';
import { lockMember, postCharges, refreshAccess } from './store';

export function fail(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}
export function reasonText(value: unknown, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    fail(`Enter a reason (1–${max} characters).`);
  return (value as string).trim();
}
export function requestKey(value: unknown) {
  if (typeof value !== 'string' || !/^[\w:.-]{8,150}$/.test(value))
    fail('A valid request ID is required. Reopen the form and try again.');
  return value as string;
}

export async function recordPayment(manager: EntityManager, data: any, author: string) {
  const amount = Number(data.amount),
    date = typeof data.transactionDate === 'string' ? data.transactionDate : '';
  if (
    !Number.isFinite(amount) ||
    (!amount && (!data.id || data.id === 'New')) ||
    Math.abs(amount) > 99999999 ||
    Math.abs(Math.round(amount * 100) - amount * 100) > 0.00001 ||
    !validDay(date) ||
    date > day(new Date()) ||
    date < '1900-01-01'
  )
    fail(
      'Use an amount with two decimal places and a date no later than today. New entries must be nonzero.',
    );
  const key = requestKey(data.requestKey);
  const member = await lockMember(manager, data.memberId);
  const duplicate = await manager.findOneBy(Transaction, { requestKey: key });
  if (duplicate) {
    if (
      duplicate.memberId !== data.memberId ||
      Number(duplicate.amount) !== amount ||
      day(duplicate.transactionDate) !== date
    )
      fail('This request ID was already used for a different payment.', 409);
    return duplicate;
  }
  let original: Transaction | null = null;
  if (data.id && data.id !== 'New') {
    original = await manager.findOneBy(Transaction, { id: data.id, memberId: data.memberId });
    if (!original || original.correctedBy || original.reversalOf)
      fail('This transaction is already corrected or cannot be corrected.', 409);
    if (original.requestKey?.startsWith('paypal:'))
      fail('Imported payments must be corrected through a refund event.');
    reasonText(data.correctionReason, 255);
  }
  const payment = await manager.save(
    Transaction,
    manager.create(Transaction, {
      memberId: member.id,
      amount,
      transactionDate: new Date(`${date}T12:00:00`),
      description: String(data.description || '').slice(0, 255),
      method: String(data.method || '').slice(0, 100),
      confirmation: String(data.confirmation || '').slice(0, 255),
      requestKey: key,
      recordedBy: author,
      correctionReason: original
        ? data.correctionReason.trim()
        : amount < 0
          ? reasonText(data.description, 255)
          : null,
    }),
  );
  if (original) {
    await manager.save(
      Transaction,
      manager.create(Transaction, {
        memberId: member.id,
        amount: -Number(original.amount),
        transactionDate: original.transactionDate,
        description: `Reversal: ${data.correctionReason.trim()}`.slice(0, 255),
        method: original.method,
        requestKey: `${key}:reversal`,
        reversalOf: original.id,
        recordedBy: author,
        correctionReason: data.correctionReason.trim(),
      }),
    );
    await manager.update(Transaction, original.id, { correctedBy: payment.id });
  }
  await recordAudit(manager, {
    memberId: member.id,
    kind: original ? 'Payment corrected' : amount < 0 ? 'Refund recorded' : 'Payment recorded',
    author,
    entityId: payment.id,
    before: snapshot(original, paymentFields),
    after: snapshot(payment, paymentFields),
    reason: payment.correctionReason || '',
  });
  await postCharges(manager, member.id);
  await refreshAccess(manager, member, author);
  return payment;
}
