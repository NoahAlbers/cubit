/**
 * Local harness for the PayPal ingestion pipeline. Simulates what the
 * webhook/sync feeds produce, without needing PayPal credentials.
 * Run: npx tsx scripts/test-paypal.ts
 */
import { prisma } from "../lib/prisma";
import { ingestPayment, processWebhookEvent } from "../lib/paypal";
import { runDailyAutomation } from "../lib/automation";

async function main() {
  const results: Record<string, unknown> = {};

  // Clean slate for repeatable runs
  await prisma.payPalTransaction.deleteMany({});
  await prisma.transaction.deleteMany({ where: { source: "PAYPAL_SYNC" } });

  const josh = await prisma.member.findUniqueOrThrow({
    where: { email: "josh.pritt@example.com" },
  });
  await prisma.member.update({
    where: { id: josh.id },
    data: {
      paypalEmail: "josh.paypal@example.com",
      paypalSubscriptionId: null,
      lastPaymentFailedAt: null,
    },
  });

  // 1. Payment matching member's paypalEmail → auto-match
  results.matchByPaypalEmail = await ingestPayment({
    paypalTransactionId: "TEST-TXN-001",
    payerEmail: "JOSH.PAYPAL@example.com", // case-insensitive
    payerName: "Josh Pritt",
    amount: 60,
    transactionDate: new Date(),
    subscriptionId: "I-TESTSUB123",
    source: "webhook",
  });

  // 2. Same transaction again → duplicate (idempotency)
  results.duplicate = await ingestPayment({
    paypalTransactionId: "TEST-TXN-001",
    payerEmail: "josh.paypal@example.com",
    amount: 60,
    transactionDate: new Date(),
    source: "sync",
  });

  // 3. Subscription id remembered from #1 → match without email
  results.matchBySubscription = await ingestPayment({
    paypalTransactionId: "TEST-TXN-002",
    payerEmail: null,
    amount: 60,
    transactionDate: new Date(),
    subscriptionId: "I-TESTSUB123",
    source: "webhook",
  });

  // 4. Unknown payer → review queue
  results.unmatched = await ingestPayment({
    paypalTransactionId: "TEST-TXN-003",
    payerEmail: "stranger@example.com",
    payerName: "Sam Stranger",
    amount: 25,
    transactionDate: new Date(),
    source: "sync",
  });

  // 5. Full webhook event shape (sale completed, sub payer)
  results.webhookEvent = await processWebhookEvent({
    id: "WH-TEST-1",
    event_type: "PAYMENT.SALE.COMPLETED",
    resource: {
      id: "TEST-TXN-004",
      amount: { total: "60.00", currency: "USD" },
      billing_agreement_id: "I-TESTSUB123",
      create_time: new Date().toISOString(),
    },
  });

  // 6. Payment failure → grace clock starts
  results.failure = (await processWebhookEvent({
    id: "WH-TEST-2",
    event_type: "PAYMENT.SALE.DENIED",
    resource: {
      billing_agreement_id: "I-TESTSUB123",
      payer: { payer_info: { email: "josh.paypal@example.com" } },
    },
  })).handled;

  const afterFailure = await prisma.member.findUniqueOrThrow({
    where: { id: josh.id },
  });
  results.graceClockSet = !!afterFailure.lastPaymentFailedAt;

  // 7. Expire the grace period and run the daily automation → PAST_DUE
  await prisma.member.update({
    where: { id: josh.id },
    data: { lastPaymentFailedAt: new Date(Date.now() - 10 * 86400_000) },
  });
  const cron = await runDailyAutomation();
  results.cronMarkedPastDue = cron.markedPastDue;
  const pastDue = await prisma.member.findUniqueOrThrow({ where: { id: josh.id } });
  results.statusAfterGrace = pastDue.status;

  // 8. New payment arrives → auto-reactivated, keys restored, clock cleared
  results.recoveryPayment = await ingestPayment({
    paypalTransactionId: "TEST-TXN-005",
    payerEmail: "josh.paypal@example.com",
    amount: 60,
    transactionDate: new Date(),
    source: "webhook",
  });
  const recovered = await prisma.member.findUniqueOrThrow({
    where: { id: josh.id },
    include: { keys: true },
  });
  results.statusAfterPayment = recovered.status;
  results.graceClockCleared = recovered.lastPaymentFailedAt === null;
  results.keysActive = recovered.keys.filter((k) => k.status === "ACTIVE").length;

  const txnCount = await prisma.transaction.count({
    where: { memberId: josh.id, source: "PAYPAL_SYNC" },
  });
  results.memberTransactionsCreated = txnCount;

  console.log(JSON.stringify(results, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
