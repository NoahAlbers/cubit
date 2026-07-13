"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { applyPaymentToMember, runPayPalSync, paypalConfigured } from "@/lib/paypal";

export type ActionState = { error?: string; ok?: boolean; info?: string };

/** Link an unmatched PayPal transaction to an existing member. */
export async function linkTransaction(
  payPalTransactionId: string,
  memberId: string,
  rememberPayerEmail: boolean
): Promise<ActionState> {
  await requirePermission("paypal.manage");

  const record = await prisma.payPalTransaction.findUnique({
    where: { id: payPalTransactionId },
  });
  if (!record) return { error: "Transaction not found." };
  if (record.status === "MATCHED") return { error: "Already matched." };

  await applyPaymentToMember(payPalTransactionId, memberId, {
    sendReceipt: false,
    rememberPayerEmail,
  });

  revalidatePath("/admin/paypal");
  return { ok: true };
}

/** Create a new (prospective) member from an unmatched transaction, then link it. */
export async function createMemberFromTransaction(
  payPalTransactionId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requirePermission(["paypal.manage", "members.create"]);

  const record = await prisma.payPalTransaction.findUnique({
    where: { id: payPalTransactionId },
  });
  if (!record) return { error: "Transaction not found." };
  if (record.status === "MATCHED") return { error: "Already matched." };

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!firstName || !lastName || !email)
    return { error: "Name and email are required." };

  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing)
    return { error: "A member with that email exists — use Link instead." };

  const memberRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Member" },
  });
  const member = await prisma.member.create({
    data: {
      firstName,
      lastName,
      email,
      paypalEmail: record.payerEmail,
      paypalSubscriptionId: record.subscriptionId,
      roleId: memberRole.id,
      status: "ACTIVE",
      joinDate: record.transactionDate,
    },
  });

  await applyPaymentToMember(payPalTransactionId, member.id, {
    sendReceipt: false,
  });

  revalidatePath("/admin/paypal");
  revalidatePath("/admin/members");
  return { ok: true };
}

/** Dismiss a transaction that isn't membership dues (donation, shop sale…). */
export async function dismissTransaction(
  payPalTransactionId: string,
  reason: string
): Promise<ActionState> {
  await requirePermission("paypal.manage");
  await prisma.payPalTransaction.update({
    where: { id: payPalTransactionId },
    data: { status: "DISMISSED", dismissReason: reason || null },
  });
  revalidatePath("/admin/paypal");
  return { ok: true };
}

/** Restore a dismissed transaction to the review queue. */
export async function restoreTransaction(
  payPalTransactionId: string
): Promise<ActionState> {
  await requirePermission("paypal.manage");
  await prisma.payPalTransaction.update({
    where: { id: payPalTransactionId },
    data: { status: "UNMATCHED", dismissReason: null },
  });
  revalidatePath("/admin/paypal");
  return { ok: true };
}

/** Manual "Sync now" from the admin page. */
export async function syncNow(): Promise<ActionState> {
  await requirePermission("paypal.manage");
  if (!paypalConfigured())
    return {
      error:
        "PayPal credentials aren't configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in the environment.",
    };
  try {
    const r = await runPayPalSync();
    revalidatePath("/admin/paypal");
    return {
      ok: true,
      info: `Scanned ${r.scanned}: ${r.matched} matched, ${r.unmatched} for review, ${r.duplicates} already known.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed." };
  }
}
