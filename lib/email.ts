import { Resend } from "resend";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

let _resend: Resend | null = null;
function resend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

/**
 * Send a notification email to a member.
 * Respects the global notifications.enabled setting and the member's
 * per-type preference, and logs every attempt as a Notification row.
 */
export async function sendMemberEmail(opts: {
  memberId: string;
  to: string;
  type: NotificationType;
  subject: string;
  body: ReactElement;
  /** Auth emails (magic link, password reset) skip the opt-out checks. */
  transactional?: boolean;
}) {
  if (!opts.transactional) {
    const enabled = await getSetting<boolean>("notifications.enabled", true);
    if (!enabled) return { skipped: "disabled" as const };

    const pref = await prisma.notificationPreference.findUnique({
      where: {
        memberId_notificationType: {
          memberId: opts.memberId,
          notificationType: opts.type,
        },
      },
    });
    if (pref && !pref.enabled) return { skipped: "opted_out" as const };
  }

  const log = await prisma.notification.create({
    data: {
      memberId: opts.memberId,
      type: opts.type,
      subject: opts.subject,
    },
  });

  try {
    const fromName = await getSetting<string>(
      "notifications.from_name",
      "Melbourne Makerspace"
    );
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "noreply@melbournemakerspace.org";
    const html = await render(opts.body);

    const { data, error } = await resend().emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html,
    });
    if (error) throw new Error(error.message);

    await prisma.notification.update({
      where: { id: log.id },
      data: { status: "SENT", sentAt: new Date(), resendMessageId: data?.id },
    });
    return { sent: true as const };
  } catch (err) {
    await prisma.notification.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return { sent: false as const, error: err };
  }
}

/** Send a plain email to admin alert addresses (no member attached). */
export async function sendAdminEmail(subject: string, body: ReactElement) {
  const recipients = await getSetting<string[]>(
    "notifications.admin_alert_emails",
    []
  );
  if (recipients.length === 0) return;

  const fromEmail =
    process.env.RESEND_FROM_EMAIL || "noreply@melbournemakerspace.org";
  const html = await render(body);
  await resend().emails.send({
    from: `Cubit <${fromEmail}>`,
    to: recipients,
    subject,
    html,
  });
}

export function appUrl(path = "") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  return `${base}${path}`;
}
