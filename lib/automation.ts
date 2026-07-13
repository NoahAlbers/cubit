import { differenceInDays, format, addDays, startOfDay } from "date-fns";
import type { MemberStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { sendMemberEmail, sendAdminEmail, appUrl } from "@/lib/email";
import { formatMoney } from "@/lib/utils";
import {
  KeyDeactivatedEmail,
  RenewalReminderEmail,
  SuspensionEmail,
  OverdueDigestEmail,
  WaiverReminderEmail,
} from "@/emails/templates";

/**
 * Change a member's status: updates the record, writes a system note,
 * and applies key-side effects (deactivate on suspend/cancel, reactivate
 * on return to active) according to system settings.
 */
export async function transitionMemberStatus(opts: {
  memberId: string;
  to: MemberStatus;
  reason?: string;
  actorId?: string | null;
  actorName?: string;
}) {
  const member = await prisma.member.findUniqueOrThrow({
    where: { id: opts.memberId },
    include: { keys: true },
  });
  if (member.status === opts.to) return member;

  const from = member.status;
  await prisma.member.update({
    where: { id: member.id },
    data: {
      status: opts.to,
      statusReason: opts.reason || null,
      statusChangedAt: new Date(),
    },
  });

  await prisma.memberNote.create({
    data: {
      memberId: member.id,
      authorId: opts.actorId ?? null,
      isSystem: true,
      content: `Status changed from ${from} to ${opts.to}${
        opts.reason ? ` — ${opts.reason}` : ""
      }${opts.actorName ? ` (by ${opts.actorName})` : " (automated)"}`,
    },
  });

  // Key side effects
  const activeKeys = member.keys.filter((k) => k.status === "ACTIVE");
  const inactiveKeys = member.keys.filter((k) => k.status === "INACTIVE");

  if (opts.to === "SUSPENDED" || opts.to === "CANCELED") {
    const auto = await getSetting<boolean>(
      "membership.auto_deactivate_keys_on_suspend",
      true
    );
    if (auto || opts.to === "CANCELED") {
      for (const key of activeKeys) {
        await prisma.key.update({
          where: { id: key.id },
          data: {
            status: opts.to === "CANCELED" ? "RETURNED" : "INACTIVE",
            deactivatedDate: new Date(),
          },
        });
        await sendMemberEmail({
          memberId: member.id,
          to: member.email,
          type: "KEY_DEACTIVATED",
          subject: "Your Melbourne Makerspace access key was deactivated",
          body: KeyDeactivatedEmail({
            firstName: member.firstName,
            serial: key.serialNumber,
            reason:
              opts.to === "CANCELED"
                ? "Membership canceled"
                : "Membership suspended",
          }),
        });
      }
    }
  }

  if (opts.to === "ACTIVE" && (from === "PAST_DUE" || from === "SUSPENDED")) {
    const auto = await getSetting<boolean>(
      "membership.auto_reactivate_keys_on_payment",
      true
    );
    if (auto) {
      for (const key of inactiveKeys) {
        await prisma.key.update({
          where: { id: key.id },
          data: { status: "ACTIVE", deactivatedDate: null },
        });
      }
    }
  }

  return prisma.member.findUniqueOrThrow({ where: { id: member.id } });
}

/** Called after a payment is recorded — auto-restores overdue members. */
export async function handlePaymentReceived(memberId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return;
  if (member.status === "PAST_DUE" || member.status === "SUSPENDED") {
    await transitionMemberStatus({
      memberId,
      to: "ACTIVE",
      reason: "Payment received",
    });
  }
}

// ---------------------------------------------------------------------------
// Daily automation (run from /api/cron/daily)
// ---------------------------------------------------------------------------

export async function runDailyAutomation() {
  const results = {
    suspended: 0,
    renewalReminders: 0,
    waiverReminders: 0,
    digestSent: false,
  };

  // 1. PAST_DUE beyond threshold → SUSPENDED
  const suspensionDays = await getSetting<number>(
    "membership.suspension_days",
    30
  );
  const pastDue = await prisma.member.findMany({
    where: { status: "PAST_DUE" },
  });
  for (const m of pastDue) {
    const since = m.statusChangedAt ?? m.updatedAt;
    const days = differenceInDays(new Date(), since);
    if (days >= suspensionDays) {
      await transitionMemberStatus({
        memberId: m.id,
        to: "SUSPENDED",
        reason: `Past due for ${days} days`,
      });
      await sendMemberEmail({
        memberId: m.id,
        to: m.email,
        type: "PAYMENT_FAILED",
        subject: "Your Melbourne Makerspace membership was suspended",
        body: SuspensionEmail({ firstName: m.firstName, daysPastDue: days }),
      });
      results.suspended++;
    }
  }

  // 2. Renewal reminders for plans ending soon
  const reminderDays = await getSetting<number[]>(
    "notifications.renewal_reminder_days",
    [7, 3]
  );
  const today = startOfDay(new Date());
  for (const days of reminderDays) {
    const target = addDays(today, days);
    const ending = await prisma.memberPlan.findMany({
      where: {
        endDate: { gte: target, lt: addDays(target, 1) },
        member: { status: { in: ["ACTIVE", "HOLD"] } },
      },
      include: { member: true, plan: true },
    });
    for (const mp of ending) {
      await sendMemberEmail({
        memberId: mp.memberId,
        to: mp.member.email,
        type: "RENEWAL_REMINDER",
        subject: `Your membership plan ends in ${days} day${days === 1 ? "" : "s"}`,
        body: RenewalReminderEmail({
          firstName: mp.member.firstName,
          planName: mp.plan.name,
          cost: formatMoney(mp.plan.monthlyCost.toString()),
          endDate: format(mp.endDate!, "MMMM d, yyyy"),
        }),
      });
      results.renewalReminders++;
    }
  }

  // 3. Waiver reminders: active members missing required waivers (weekly, same day as digest)
  const digestDay = await getSetting<string>(
    "notifications.overdue_digest_day",
    "monday"
  );
  const todayName = format(new Date(), "EEEE").toLowerCase();
  if (todayName === digestDay) {
    const required = await prisma.waiverTemplate.findMany({
      where: { isRequired: true, isActive: true },
    });
    if (required.length > 0) {
      const activeMembers = await prisma.member.findMany({
        where: { status: "ACTIVE" },
        include: { waivers: { where: { status: "COMPLETED" } } },
      });
      for (const m of activeMembers) {
        const completed = new Set(m.waivers.map((w) => w.waiverId));
        const missing = required.filter((r) => !completed.has(r.id));
        if (missing.length > 0) {
          await sendMemberEmail({
            memberId: m.id,
            to: m.email,
            type: "WAIVER_REMINDER",
            subject: "Please sign your Melbourne Makerspace waiver",
            body: WaiverReminderEmail({
              firstName: m.firstName,
              waiverNames: missing.map((w) => w.name),
              portalUrl: appUrl("/member/waivers"),
            }),
          });
          results.waiverReminders++;
        }
      }
    }

    // 4. Weekly overdue digest to admins
    const overdue = await prisma.member.findMany({
      where: { status: { in: ["PAST_DUE", "SUSPENDED"] } },
      orderBy: { statusChangedAt: "asc" },
    });
    await sendAdminEmail(
      `Overdue digest: ${overdue.length} member(s)`,
      OverdueDigestEmail({
        rows: overdue.map((m) => ({
          name: `${m.firstName} ${m.lastName}`,
          email: m.email,
          status: m.status,
          days: differenceInDays(new Date(), m.statusChangedAt ?? m.updatedAt),
        })),
      })
    );
    results.digestSent = true;
  }

  return results;
}
