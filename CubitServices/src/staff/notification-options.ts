export const notificationTopics = [
  {
    id: 'memberCreated',
    group: 'Members & plans',
    label: 'New member accounts',
    description: 'A staff member creates a member record.',
  },
  {
    id: 'contactChanged',
    group: 'Members & plans',
    label: 'Contact details updated',
    description: 'Member contact or emergency-contact information changes.',
  },
  {
    id: 'staffNoteAdded',
    group: 'Members & plans',
    label: 'New staff notes',
    description: 'A note is added to a member account.',
  },
  {
    id: 'planAssigned',
    group: 'Members & plans',
    label: 'Plans started or changed',
    description: 'A membership plan is assigned or replaced.',
  },
  {
    id: 'planEnded',
    group: 'Members & plans',
    label: 'Plans ended or canceled',
    description: 'A final billing date is saved.',
  },
  {
    id: 'catalogChanged',
    group: 'Members & plans',
    label: 'Plan catalog changes',
    description: 'A plan is created, repriced or retired.',
  },
  {
    id: 'paymentReceived',
    group: 'Payments & billing',
    label: 'Payments recorded',
    description: 'A payment is posted to a member account.',
  },
  {
    id: 'paymentFailed',
    group: 'Payments & billing',
    label: 'Failed payments',
    description: 'A future connected payment provider reports a failed payment.',
  },
  {
    id: 'paymentNeedsMatch',
    group: 'Payments & billing',
    label: 'Payments needing a match',
    description: 'An unmatched payer needs staff review.',
  },
  {
    id: 'refundRecorded',
    group: 'Payments & billing',
    label: 'Refunds or reversals',
    description: 'A payment is refunded or reversed.',
  },
  {
    id: 'billingCorrected',
    group: 'Payments & billing',
    label: 'Billing corrections',
    description: 'Staff corrects a charge or payment.',
  },
  {
    id: 'memberPastDue',
    group: 'Payments & billing',
    label: 'New past-due memberships',
    description: 'A member becomes past due; no recurring collection reminders.',
  },
  {
    id: 'accessSuspended',
    group: 'Access & keys',
    label: 'Grace period expired',
    description: 'Eligibility is suspended after the grace window.',
  },
  {
    id: 'accessRestored',
    group: 'Access & keys',
    label: 'Membership access restored',
    description: 'A payment or billing-rule change restores eligibility.',
  },
  {
    id: 'manualAccessChanged',
    group: 'Access & keys',
    label: 'Staff access blocks changed',
    description: 'A staff block is added or removed.',
  },
  {
    id: 'keyChanged',
    group: 'Access & keys',
    label: 'Key assignments or status changes',
    description: 'A key is assigned, enabled, disabled or removed.',
  },
  {
    id: 'doorOffline',
    group: 'Access & keys',
    label: 'Door connection unavailable',
    description: 'A future monitored controller stops reporting.',
  },
  {
    id: 'waiverSigned',
    group: 'Waivers',
    label: 'Waivers signed',
    description: 'A completed digital signature is verified.',
  },
  {
    id: 'waiverUploaded',
    group: 'Waivers',
    label: 'Uploads needing review',
    description: 'A member or staff uploads a signed document.',
  },
  {
    id: 'waiverRejected',
    group: 'Waivers',
    label: 'Waiver uploads rejected',
    description: 'Staff rejects an uploaded document with a reason.',
  },
  {
    id: 'waiverMissing',
    group: 'Waivers',
    label: 'Missing required waivers',
    description: 'An active member first needs a required waiver or new version.',
  },
  {
    id: 'waiverPublished',
    group: 'Waivers',
    label: 'New waiver versions',
    description: 'A new document or required version is published.',
  },
  {
    id: 'loginEmailChanged',
    group: 'Accounts & security',
    label: 'Member login email changes',
    description: 'A member changes their portal login email.',
  },
  {
    id: 'staffPermissionsChanged',
    group: 'Accounts & security',
    label: 'Staff roles or access changed',
    description: 'A staff account is created, disabled or changes role.',
    administration: true,
  },
  {
    id: 'accountSecurityChanged',
    group: 'Accounts & security',
    label: 'Staff password or MFA changes',
    description: 'A staff password or authenticator enrollment changes.',
    administration: true,
  },
  {
    id: 'signInBlocked',
    group: 'Accounts & security',
    label: 'Repeated failed staff sign-ins',
    description: 'A future security event indicates an account cooldown.',
    administration: true,
  },
  {
    id: 'processingFailed',
    group: 'Operations & recovery',
    label: 'Billing processing failures',
    description: 'An automation run fails or requires attention.',
  },
  {
    id: 'backupFailed',
    group: 'Operations & recovery',
    label: 'Backup failures',
    description: 'A backup job fails.',
  },
  {
    id: 'backupCompleted',
    group: 'Operations & recovery',
    label: 'Backup completed',
    description: 'A scheduled or manual backup finishes.',
  },
  {
    id: 'restoreTestFailed',
    group: 'Operations & recovery',
    label: 'Recovery test failures',
    description: 'An isolated restoration test fails.',
  },
  {
    id: 'storageLow',
    group: 'Operations & recovery',
    label: 'Low backup storage',
    description: 'Future storage monitoring detects a capacity warning.',
  },
  {
    id: 'integrationUnavailable',
    group: 'Operations & recovery',
    label: 'Integration failures',
    description: 'A configured provider cannot be reached or rejects authentication.',
  },
] as const;
export type NotificationTopic = (typeof notificationTopics)[number]['id'];
export type TopicChoices = Partial<Record<NotificationTopic, boolean>>;
export type DeliveryOptions = { quietHours: boolean; start: string; end: string; timezone: string };
export const defaultDelivery: DeliveryOptions = {
  quietHours: false,
  start: '22:00',
  end: '08:00',
  timezone: 'UTC',
};
export const availableTopics = (role: string) =>
  notificationTopics.filter((topic) => !('administration' in topic) || role === 'admin');
export const visibleChoices = (
  choices: TopicChoices | null | undefined,
  role: string,
): TopicChoices =>
  Object.fromEntries(availableTopics(role).map((t) => [t.id, choices?.[t.id] === true]));
export function inQuietHours(at: number, options: DeliveryOptions) {
  if (!options.quietHours) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: options.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const time =
    parts.find((p) => p.type === 'hour')!.value +
    ':' +
    parts.find((p) => p.type === 'minute')!.value;
  return options.start < options.end
    ? time >= options.start && time < options.end
    : time >= options.start || time < options.end;
}
// Preview only: no queue or delivery side effects. Live dispatch must recheck
// recipient roles, use durable suppression, and obtain events from trusted sources.
export function previewNotifications(
  enabled: boolean,
  choices: TopicChoices,
  delivery: DeliveryOptions,
  role: string,
  at: number,
) {
  return availableTopics(role).map((topic) => ({
    topic: topic.label,
    group: topic.group,
    decision:
      !enabled || !choices[topic.id]
        ? 'Not selected'
        : inQuietHours(at, delivery)
          ? 'Quiet hours — defer'
          : 'Would alert',
  }));
}
