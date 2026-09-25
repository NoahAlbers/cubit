import { organizationCurrency } from '../organization/currency';
import { organizationDay } from '../organization/time';
import { validEmail } from '../contact/validation';
import { recordAudit, snapshot, profileFields } from '../staff/audit';
import { createHash } from 'crypto';
import { AppDataSource } from '../database';
import { MemberPlan } from '../entity/memberPlan';
import { Member, ROLES } from '../entity/member';
import { Transaction } from '../entity/transaction';
import { PaymentEvent, OperationsSettings } from '../entity/cubitOperations';
import { recordPayment, fail, requestKey } from './payments';
import { validDay } from './ledger';

// This local fixture endpoint cannot establish PayPal authenticity. Live webhooks remain blocked.
export async function receiveSimulation(body: any, author: string) {
  const payerEmail = paymentEmail(body.payerEmail || '', false),
    payerName = String(body.payerName || '').trim();
  if (payerName.length > 150) fail('Payer name may be at most 150 characters.');
  if (body.currency && body.currency !== organizationCurrency)
    fail(`Only ${organizationCurrency} test events can be reviewed in this workspace.`);
  const input = {
    id: requestKey(body.id),
    kind: String(body.kind),
    resourceId: requestKey(body.resourceId),
    subscriptionId: String(body.subscriptionId || '').slice(0, 100),
    parentResourceId: String(body.parentResourceId || '').slice(0, 100),
    eventDate: body.eventDate,
    amount: Number(body.amount || 0),
  };
  if (input.resourceId.length > 100) fail('Resource IDs may be at most 100 characters.');
  if (
    !['payment', 'refund', 'cancellation'].includes(input.kind) ||
    !validDay(input.eventDate) ||
    input.eventDate > organizationDay() ||
    input.eventDate < '1900-01-01' ||
    !Number.isFinite(input.amount) ||
    input.amount < 0 ||
    input.amount > 99999999 ||
    Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.00001 ||
    (input.kind !== 'cancellation' && !input.amount)
  )
    fail('Invalid test event.');
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        ...(payerEmail ? { payerEmail } : {}),
        ...(payerName ? { payerName } : {}),
      }),
    )
    .digest('hex');
  const previous = await AppDataSource.manager.findOneBy(PaymentEvent, { id: input.id });
  if (previous) {
    if (previous.payloadHash !== hash)
      fail('Event ID already exists with different contents.', 409);
    return previous;
  }
  try {
    return await AppDataSource.transaction(async (manager) => {
      const saved = await manager.save(
        PaymentEvent,
        manager.create(PaymentEvent, {
          ...input,
          payerEmail,
          payerName,
          payloadHash: hash,
          detail: 'Offline test event. Staff must choose a member before recording it.',
          status: 'Unmatched',
        }),
      );
      await recordAudit(manager, {
        kind: 'Test event received',
        author,
        entityId: saved.id,
        after: {
          kind: saved.kind,
          resourceId: saved.resourceId,
          payerEmail: saved.payerEmail,
          amount: saved.amount,
          eventDate: saved.eventDate,
        },
      });
      return saved;
    });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      const row = await AppDataSource.manager.findOneByOrFail(PaymentEvent, { id: input.id });
      if (row.payloadHash !== hash) fail('Event ID conflict.', 409);
      return row;
    }
    throw err;
  }
}

export function paymentEmail(value: any, required = true) {
  if (typeof value !== 'string') fail('Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (!email && !required) return '';
  if (!validEmail(email)) fail('Enter a valid email address.');
  return email;
}
export function newMemberValues(body: any) {
  if (!body || body.confirmCreate !== true) fail('Confirm that you want to create a new member.');
  const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '',
    lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100)
    fail('Enter a first and last name (at most 100 characters each).');
  return { firstName, lastName, email: paymentEmail(body.email) };
}

export async function processEvent(
  id: string,
  memberId: string | undefined,
  author: string,
  createMember?: any,
) {
  if (memberId && createMember) fail('Choose an existing member or create a new one, not both.');
  if (memberId !== undefined && typeof memberId !== 'string') fail('Choose a valid member.');
  const newValues = createMember ? newMemberValues(createMember) : null;
  return AppDataSource.transaction(async (manager) => {
    // Serialize reconciliation/creation, including different event IDs for the
    // same capture. A retry must never leave an extra member or payment behind.
    await manager.findOneOrFail(OperationsSettings, {
      where: { id: 'default' },
      lock: { mode: 'pessimistic_write' },
    });
    const event = await manager.findOne(PaymentEvent, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!event) fail('Event not found.', 404);
    if (event.status === 'Processed') {
      if (memberId && memberId !== event.memberId)
        fail('This event was already recorded for another member.', 409);
      return event;
    }
    event.attempts++;
    let selected = memberId || event.memberId || '';
    const duplicate =
      event.kind === 'cancellation'
        ? null
        : await manager.findOneBy(Transaction, {
            requestKey: `paypal:${event.kind}:${event.resourceId}`,
          });
    if (duplicate && newValues)
      fail(
        'This payment is already recorded. Match it to the existing member instead of creating another.',
        409,
      );
    if (newValues) {
      if (event.kind !== 'payment')
        fail(
          'Only an unmatched payment can create a member. Match refunds and cancellations to an existing member.',
        );
      const emails = [...new Set([newValues.email, event.payerEmail].filter(Boolean))];
      const existing = await manager
        .createQueryBuilder(Member, 'm')
        .where(
          'LOWER(TRIM(m.email)) IN (:...emails) OR LOWER(TRIM(m.paypalEmail)) IN (:...emails)',
          { emails },
        )
        .getCount();
      if (existing)
        fail(
          'A member already uses this contact or payer email. Search and match that member instead.',
          409,
        );
      const member = await manager.save(
        Member,
        manager.create(Member, {
          ...newValues,
          paypalEmail: event.payerEmail || newValues.email,
          password: 'Not Set',
          role: ROLES.MEMBER,
          status: 'Inactive',
          statusReason: 'No membership plan assigned',
          balance: 0,
        }),
      );
      selected = member.id;
      await recordAudit(manager, {
        memberId: selected,
        kind: 'Member created from payment',
        author,
        entityId: member.id,
        after: snapshot(member, profileFields),
        reason: 'Explicitly created while matching offline event ' + event.id,
      });
    }
    if (!selected || !(await manager.findOneBy(Member, { id: selected }))) {
      fail('Choose an existing member or explicitly create a member before recording this event.');
    }
    const beforeEvent = { memberId: event.memberId, status: event.status };
    event.memberId = selected;
    if (event.kind === 'cancellation') {
      const memberPlans = await manager.find(MemberPlan, {
        where: { memberId: selected },
        order: { startDate: 'DESC' },
      });
      const plan = memberPlans.find(
        (p) => !event.subscriptionId || p.paypalSubscriptionId === event.subscriptionId,
      );
      if (plan?.finalBillingDate) {
        event.status = 'Processed';
        event.detail = `Staff final billing date reviewed: ${plan.finalBillingDate}.`;
      } else {
        event.status = 'Needs final billing date';
        event.detail =
          'Staff must review the member plan and set the final billing date, then retry this review. No dates or balances were changed.';
      }
    } else {
      if (event.kind === 'refund') {
        const original = await manager.findOneBy(Transaction, {
          requestKey: `paypal:payment:${event.parentResourceId}`,
        });
        if (!original || original.memberId !== selected)
          fail('Match the original payment before processing this refund.');
        // Serialize refunds on the original capture as well as on the member row.
        await manager.findOneOrFail(Transaction, {
          where: { id: original.id },
          lock: { mode: 'pessimistic_write' },
        });
        const refunds = await manager.find(PaymentEvent, {
          where: { parentResourceId: event.parentResourceId, kind: 'refund', status: 'Processed' },
        });
        const sameResource = refunds.find((r) => r.resourceId === event.resourceId);
        const distinct = [...new Map(refunds.map((r) => [r.resourceId, r])).values()];
        if (
          !sameResource &&
          Math.round(
            (distinct.reduce((n, r) => n + Number(r.amount), 0) + Number(event.amount)) * 100,
          ) > Math.round(Number(original.amount) * 100)
        )
          fail('Refund exceeds the original payment.');
      }
      await recordPayment(
        manager,
        {
          id: 'New',
          memberId: selected,
          amount: (event.kind === 'refund' ? -1 : 1) * Number(event.amount),
          transactionDate: event.eventDate,
          description: `PayPal ${event.kind} simulation ${event.resourceId}`,
          method: 'PayPal simulation',
          requestKey: `paypal:${event.kind}:${event.resourceId}`,
          confirmation: event.resourceId,
        },
        author,
      );
      event.status = 'Processed';
      event.detail = 'Recorded once; member balance and access recalculated.';
    }
    await recordAudit(manager, {
      memberId: selected,
      kind: 'Event reconciliation',
      author,
      entityId: event.id,
      before: beforeEvent,
      after: { memberId: selected, status: event.status },
      reason: event.detail,
    });
    return manager.save(event);
  });
}
