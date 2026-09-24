import { recordAudit } from '../staff/audit';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '../database';
import { Member } from '../entity/member';
import { AutomationRun, OperationsSettings } from '../entity/cubitOperations';
import { billingLedger, day } from './ledger';
import { lockMember, postCharges, readBilling, refreshAccess } from './store';
import { postedLedger, accessDecision } from './posted-ledger';

export async function automationPlan(
  manager: EntityManager,
  settings: OperationsSettings,
  apply: boolean,
) {
  const today = day(new Date()),
    actions: any[] = [];
  let newCharges = 0;
  const members = await manager.find(Member, { order: { id: 'ASC' } });
  for (const row of members) {
    const member = apply ? await lockMember(manager, row.id) : row;
    const before = await readBilling(manager, member.id);
    const scheduled = billingLedger(
      before.plans.map((p) => ({
        ...p,
        plan: {
          name: p.billingName || p.plan.name,
          monthlyCost: p.billingRate ?? p.plan.monthlyCost,
        },
      })),
      [],
    ).charges;
    const missing = scheduled.filter(
      (c) => !before.records.some((r) => r.memberPlanId === c.planId && r.dueDate === c.dueDate),
    );
    newCharges += missing.length;
    const previewLedger = postedLedger(
      [
        ...before.records,
        ...missing.map((c) => ({ ...c, id: `${c.planId}:${c.dueDate}`, memberPlanId: c.planId })),
      ],
      before.payments,
      before.adjustments,
    );
    const decision = accessDecision(member, before.plans, previewLedger, settings.graceDays);
    if (member.status !== decision.status || member.billingSuspended !== decision.suspended)
      actions.push({
        memberId: member.id,
        name: `${member.firstName} ${member.lastName}`,
        from: member.status || 'Inactive',
        to: decision.status,
        reason: decision.reason,
      });
    if (apply) {
      await postCharges(manager, member.id);
      await refreshAccess(manager, member);
    }
  }
  return { date: today, members: members.length, newCharges, accessChanges: actions };
}

export async function runAutomation(preview: boolean, trigger: string, daily = false) {
  const id = daily ? `daily:${day(new Date())}` : randomUUID();
  try {
    return await AppDataSource.transaction(async (manager) => {
      const settings = await manager.findOneOrFail(OperationsSettings, {
        where: { id: 'default' },
        lock: { mode: 'pessimistic_write' },
      });
      const prior = await manager.findOneBy(AutomationRun, { id });
      if (daily && (!settings.dailyEnabled || prior?.status === 'Completed'))
        return { skipped: true };
      const summary = await automationPlan(manager, settings, !preview);
      if (!preview) {
        await manager.save(
          AutomationRun,
          manager.create(AutomationRun, {
            id,
            status: 'Completed',
            trigger,
            summary: JSON.stringify(summary),
          }),
        );
        await recordAudit(manager, {
          kind: 'Billing processing completed',
          author: trigger,
          entityId: id,
          after: { newCharges: summary.newCharges, accessChanges: summary.accessChanges.length },
          actorType: daily ? 'system' : 'staff',
        });
      }
      return summary;
    });
  } catch (err: any) {
    if (!preview)
      await AppDataSource.manager.save(
        AutomationRun,
        AppDataSource.manager.create(AutomationRun, {
          id: `${id}:failed:${randomUUID()}`,
          status: 'Failed',
          trigger,
          summary: JSON.stringify({ error: err.message }),
        }),
      );
    throw err;
  }
}

export function startAutomationScheduler() {
  let busy = false;
  const tick = async () => {
    if (busy || new Date().getHours() < 9) return;
    busy = true;
    try {
      await runAutomation(false, 'Daily schedule', true);
    } catch (err: any) {
      console.error('Automation run failed:', err.message);
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
