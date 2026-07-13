import { BrandEmail, EmailButton, EmailText, DangerText } from "./base";

export function MagicLinkEmail({
  firstName,
  url,
  isWelcome,
}: {
  firstName: string;
  url: string;
  isWelcome?: boolean;
}) {
  return (
    <BrandEmail
      preview={isWelcome ? "Welcome to Melbourne Makerspace" : "Your sign-in link"}
      heading={isWelcome ? `Welcome, ${firstName}!` : `Hi ${firstName},`}
    >
      <EmailText>
        {isWelcome
          ? "Your Melbourne Makerspace member account is ready. Use the button below to set your password and sign in to the member portal — where you can check your membership, payments, certifications, and sign waivers."
          : "Use the button below to sign in to your Melbourne Makerspace account."}
      </EmailText>
      <EmailButton href={url}>
        {isWelcome ? "Set up my account" : "Sign in"}
      </EmailButton>
      <EmailText> </EmailText>
      <EmailText>
        This link expires in 24 hours. If you didn&apos;t request it, you can
        safely ignore this email.
      </EmailText>
    </BrandEmail>
  );
}

export function PasswordResetEmail({
  firstName,
  url,
}: {
  firstName: string;
  url: string;
}) {
  return (
    <BrandEmail preview="Reset your password" heading={`Hi ${firstName},`}>
      <EmailText>
        Someone requested a password reset for your Melbourne Makerspace
        account. Click below to choose a new password.
      </EmailText>
      <EmailButton href={url}>Reset password</EmailButton>
      <EmailText> </EmailText>
      <EmailText>
        This link expires in 1 hour. If you didn&apos;t request it, ignore this
        email — your password won&apos;t change.
      </EmailText>
    </BrandEmail>
  );
}

export function KeyDeactivatedEmail({
  firstName,
  serial,
  reason,
}: {
  firstName: string;
  serial: string;
  reason: string;
}) {
  return (
    <BrandEmail preview="Your access key was deactivated" heading={`Hi ${firstName},`}>
      <DangerText>Your key ({serial}) has been deactivated.</DangerText>
      <EmailText>Reason: {reason}</EmailText>
      <EmailText>
        If you believe this is a mistake, or to restore access, please contact
        the makerspace staff at admin@melbournemakerspace.org.
      </EmailText>
    </BrandEmail>
  );
}

export function RenewalReminderEmail({
  firstName,
  planName,
  cost,
  endDate,
}: {
  firstName: string;
  planName: string;
  cost: string;
  endDate: string;
}) {
  return (
    <BrandEmail preview="Your membership plan is ending soon" heading={`Hi ${firstName},`}>
      <EmailText>
        Your <strong>{planName}</strong> plan ({cost}/month) ends on{" "}
        <strong>{endDate}</strong>.
      </EmailText>
      <EmailText>
        To keep your access uninterrupted, renew via the PayPal subscription
        button at melbournemakerspace.org, or talk to any staff member.
      </EmailText>
    </BrandEmail>
  );
}

export function SuspensionEmail({
  firstName,
  daysPastDue,
}: {
  firstName: string;
  daysPastDue: number;
}) {
  return (
    <BrandEmail preview="Your membership has been suspended" heading={`Hi ${firstName},`}>
      <DangerText>
        Your membership has been suspended after {daysPastDue} days past due,
        and your door access has been paused.
      </DangerText>
      <EmailText>
        Bring your account current to restore access — once payment is
        received your keys reactivate automatically. Questions? Reply to this
        email or contact admin@melbournemakerspace.org.
      </EmailText>
    </BrandEmail>
  );
}

export function WaiverReminderEmail({
  firstName,
  waiverNames,
  portalUrl,
}: {
  firstName: string;
  waiverNames: string[];
  portalUrl: string;
}) {
  return (
    <BrandEmail preview="Action needed: sign your waiver" heading={`Hi ${firstName},`}>
      <EmailText>
        Our records show you still need to sign:{" "}
        <strong>{waiverNames.join(", ")}</strong>.
      </EmailText>
      <EmailText>
        You can read and sign digitally from your member portal in under two
        minutes.
      </EmailText>
      <EmailButton href={portalUrl}>Sign now</EmailButton>
    </BrandEmail>
  );
}

export function OverdueDigestEmail({
  rows,
}: {
  rows: { name: string; email: string; status: string; days: number }[];
}) {
  return (
    <BrandEmail
      preview={`${rows.length} member(s) overdue`}
      heading="Weekly overdue digest"
      footerNote="Automated digest from Cubit."
    >
      {rows.length === 0 ? (
        <EmailText>No members are currently past due. 🎉</EmailText>
      ) : (
        rows.map((r) => (
          <EmailText key={r.email}>
            <strong>{r.name}</strong> ({r.email}) — {r.status},{" "}
            {r.days} days
          </EmailText>
        ))
      )}
    </BrandEmail>
  );
}
