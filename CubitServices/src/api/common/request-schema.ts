import { notificationTopics } from '../../staff/notification-options';
import { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import { validDay } from '../../billing/ledger';

const text = (max: number) => z.string().trim().min(1).max(max);
const id = z.string().min(1).max(150);
const revision = z.number().int().nonnegative();
const money = z
  .number()
  .finite()
  .min(0)
  .max(99999999)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
    'Use at most two decimal places.',
  );
const date = z.string().refine(validDay, 'Use a valid calendar date.');
export const emptyBody = z.strictObject({}).default({});
export const bodies = {
  note: z.strictObject({ text: text(4000) }),
  access: z.strictObject({ accessHold: z.boolean(), reason: text(500) }),
  credit: z.strictObject({ credit: money.positive(), reason: text(500), requestKey: id }),
  charge: z.strictObject({
    amount: money.positive(),
    description: text(255),
    date,
    requestKey: id,
  }),
  correction: z.strictObject({
    amount: money,
    expectedAmount: money,
    reason: text(500),
    requestKey: id,
  }),
  automation: z.strictObject({
    id: z.literal('default').optional(),
    graceDays: z.number().int().min(0).max(365),
    dailyEnabled: z.boolean(),
    version: revision,
    migrationSummary: z.string().nullable().optional(),
  }),
  run: z.strictObject({ preview: z.boolean() }),
  simulation: z.strictObject({
    id,
    kind: z.enum(['payment', 'refund', 'cancellation']),
    resourceId: id,
    subscriptionId: z.string().max(100).optional(),
    parentResourceId: z.string().max(100).optional(),
    eventDate: date,
    amount: money.optional(),
    payerEmail: z.string().max(254).optional(),
    payerName: z.string().max(150).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
  match: z.strictObject({
    memberId: z.string().max(150).optional(),
    createMember: z
      .strictObject({
        confirmCreate: z.literal(true),
        firstName: text(100),
        lastName: text(100),
        email: text(254),
      })
      .optional(),
  }),
  preferences: z.strictObject({
    enabled: z.boolean(),
    unknownFobs: z.boolean(),
    refusedFobs: z.boolean(),
    dedupeMinutes: z.number().int().min(1).max(1440),
    topics: z.partialRecord(z.enum(notificationTopics.map((t) => t.id)), z.boolean()).optional(),
    delivery: z
      .strictObject({
        quietHours: z.boolean(),
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        timezone: z
          .string()
          .min(1)
          .max(64)
          .refine((value) => {
            try {
              new Intl.DateTimeFormat('en', { timeZone: value });
              return true;
            } catch {
              return false;
            }
          }, 'Choose a valid time zone.'),
      })
      .refine(
        (value) => !value.quietHours || value.start !== value.end,
        'Quiet hours need different start and end times.',
      )
      .optional(),
    revision,
  }),
  waiver: z.strictObject({
    name: text(150),
    description: text(2000),
    required: z.boolean(),
    provider: z.enum(['demo', 'paper', 'docuseal']),
    demoText: z.string().max(20000).optional(),
    signerRole: z.string().max(100).optional(),
    docusealTemplateId: z.number().int().positive().nullable().optional(),
    sourceDocumentId: z.string().max(150).nullable().optional(),
    revision: revision.optional(),
  }),
  archive: z.strictObject({ archived: z.boolean(), revision }),
  review: z.strictObject({
    status: z.enum(['Accepted', 'Rejected']),
    reason: text(2000),
    revision,
  }),
  document: z
    .instanceof(Buffer)
    .refine(
      (b) => b.length >= 12 && b.length <= 10 * 1024 * 1024,
      'Choose a PDF, JPG or PNG up to 10 MB.',
    ),
  backup: z.strictObject({
    revision,
    settings: z.strictObject({
      frequency: z.enum(['manual', 'daily', 'weekly', 'monthly']),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      timezone: text(60),
      weekday: z.number().int().min(0).max(6),
      monthday: z.number().int().min(1).max(31),
      localKeep: z.number().int().min(3).max(365),
      remoteKeep: z.number().int().min(3).max(365),
      offsiteEnabled: z.boolean(),
      verifyDays: z.number().int().min(0).max(90),
    }),
  }),
  job: z
    .strictObject({
      kind: z.enum(['backup', 'verify', 'prune']),
      snapshot: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      revision: revision.optional(),
    })
    .refine((b) => !b.snapshot || b.kind === 'verify', 'Only recovery tests accept a snapshot.'),
};

type Handler<B> = (
  req: Request<Record<string, string>, unknown, B>,
  res: Response,
) => Promise<unknown>;
export function route(fn: Handler<z.output<typeof emptyBody>>): RequestHandler;
export function route<S extends z.ZodType>(schema: S, fn: Handler<z.output<S>>): RequestHandler;
export function route<S extends z.ZodType>(
  schemaOrFn: S | Handler<z.output<typeof emptyBody>>,
  fn?: Handler<z.output<S>>,
): RequestHandler {
  const schema = typeof schemaOrFn === 'function' ? emptyBody : schemaOrFn;
  const handler = typeof schemaOrFn === 'function' ? schemaOrFn : fn!;
  return async (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      // Describe the field, never include submitted secrets or document contents.
      const issue = parsed.error.issues[0],
        field = issue.path.join('.') || 'request';
      return next(Object.assign(Error(`Invalid ${field}: ${issue.message}`), { status: 400 }));
    }
    if (Object.values(req.params).some((value) => typeof value !== 'string'))
      return next(Object.assign(Error('Invalid route parameter.'), { status: 400 }));
    req.body = parsed.data;
    try {
      await (handler as Handler<unknown>)(
        req as Request<Record<string, string>, unknown, unknown>,
        res,
      );
    } catch (error) {
      next(error);
    }
  };
}
