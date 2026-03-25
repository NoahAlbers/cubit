import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Permissions ────────────────────────────────────────────────────────────

const permissions = [
  // Members
  { key: "members.view", category: "members", name: "View members", description: "View member list and profiles" },
  { key: "members.create", category: "members", name: "Create members", description: "Create new member records" },
  { key: "members.edit", category: "members", name: "Edit members", description: "Edit member profiles and status" },
  { key: "members.delete", category: "members", name: "Delete members", description: "Delete/archive member records" },
  { key: "members.notes.view", category: "members", name: "View member notes", description: "View staff notes on members" },
  { key: "members.notes.create", category: "members", name: "Create member notes", description: "Add staff notes to members" },
  { key: "members.invite", category: "members", name: "Invite members", description: "Send magic link invitations" },

  // Plans
  { key: "plans.view", category: "plans", name: "View plans", description: "View plans" },
  { key: "plans.manage", category: "plans", name: "Manage plans", description: "Create, edit, deactivate plans" },
  { key: "plans.assign", category: "plans", name: "Assign plans", description: "Assign/modify member plan assignments" },

  // Keys
  { key: "keys.view", category: "keys", name: "View keys", description: "View key assignments" },
  { key: "keys.manage", category: "keys", name: "Manage keys", description: "Add, remove, activate, deactivate keys" },

  // Transactions
  { key: "transactions.view", category: "transactions", name: "View transactions", description: "View transaction history" },
  { key: "transactions.create", category: "transactions", name: "Create transactions", description: "Manually create transactions" },
  { key: "transactions.edit", category: "transactions", name: "Edit transactions", description: "Edit existing transactions" },
  { key: "transactions.delete", category: "transactions", name: "Delete transactions", description: "Delete transactions" },

  // Equipment
  { key: "equipment.view", category: "equipment", name: "View equipment", description: "View equipment inventory" },
  { key: "equipment.manage", category: "equipment", name: "Manage equipment", description: "Add, edit, retire equipment" },
  { key: "equipment.certify", category: "equipment", name: "Certify members", description: "Grant/revoke member certifications" },
  { key: "equipment.maintenance", category: "equipment", name: "Log maintenance", description: "Log maintenance entries" },

  // Waivers
  { key: "waivers.view", category: "waivers", name: "View waivers", description: "View waiver status" },
  { key: "waivers.manage", category: "waivers", name: "Manage waivers", description: "Create/edit waiver templates, mark complete" },

  // Dashboard
  { key: "dashboard.view", category: "dashboard", name: "View dashboard", description: "View admin dashboard" },
  { key: "dashboard.configure", category: "dashboard", name: "Configure dashboard", description: "Customize dashboard widget layout" },

  // Reports
  { key: "reports.view", category: "reports", name: "View reports", description: "View reports" },
  { key: "reports.export", category: "reports", name: "Export reports", description: "Export reports (CSV, PDF)" },

  // Notifications
  { key: "notifications.send", category: "notifications", name: "Send notifications", description: "Send bulk notifications/announcements" },
  { key: "notifications.manage", category: "notifications", name: "Manage notifications", description: "Manage notification templates and settings" },

  // Settings
  { key: "settings.view", category: "settings", name: "View settings", description: "View system settings" },
  { key: "settings.manage", category: "settings", name: "Manage settings", description: "Modify system settings" },

  // Roles
  { key: "roles.view", category: "roles", name: "View roles", description: "View roles and permissions" },
  { key: "roles.manage", category: "roles", name: "Manage roles", description: "Create, edit, delete roles and assign permissions" },

  // Bulk Actions
  { key: "bulk_actions.execute", category: "bulk_actions", name: "Execute bulk actions", description: "Run bulk operations" },

  // PayPal
  { key: "paypal.view", category: "paypal", name: "View PayPal", description: "View PayPal sync status and unmatched transactions" },
  { key: "paypal.manage", category: "paypal", name: "Manage PayPal", description: "Link unmatched transactions, configure PayPal settings" },
];

// ─── Plans ──────────────────────────────────────────────────────────────────

const plans = [
  { name: "Standard Membership", monthlyCost: 60.00, keysIncluded: 1, eligibleMembershipTypes: ["STANDARD", "SPONSORSHIP"] },
  { name: "Student Membership (18-28)", monthlyCost: 30.00, keysIncluded: 1, eligibleMembershipTypes: ["STUDENT"] },
  { name: "Standard + 1 Key", monthlyCost: 90.00, keysIncluded: 2, eligibleMembershipTypes: ["STANDARD"] },
  { name: "Standard + 2 Keys", monthlyCost: 120.00, keysIncluded: 3, eligibleMembershipTypes: ["STANDARD"] },
  { name: "Standard + 3 Keys", monthlyCost: 150.00, keysIncluded: 4, eligibleMembershipTypes: ["STANDARD"] },
  { name: "Scholarship", monthlyCost: 0.00, keysIncluded: 1, eligibleMembershipTypes: ["SCHOLARSHIP"] },
];

// ─── System Settings ────────────────────────────────────────────────────────

const systemSettings = [
  // Organization
  { key: "org.name", value: "Melbourne Makerspace", category: "organization", label: "Organization Name", fieldType: "text" },
  { key: "org.email", value: "admin@melbournemakerspace.org", category: "organization", label: "Organization Email", fieldType: "email" },
  { key: "org.website", value: "https://melbournemakerspace.org", category: "organization", label: "Website", fieldType: "text" },
  { key: "org.address", value: "", category: "organization", label: "Address", fieldType: "text" },
  { key: "org.phone", value: "", category: "organization", label: "Phone", fieldType: "text" },
  { key: "org.logo_url", value: "", category: "organization", label: "Logo URL", fieldType: "text" },
  { key: "org.timezone", value: "America/New_York", category: "organization", label: "Timezone", fieldType: "select", options: [{ label: "Eastern (America/New_York)", value: "America/New_York" }, { label: "Central (America/Chicago)", value: "America/Chicago" }, { label: "Mountain (America/Denver)", value: "America/Denver" }, { label: "Pacific (America/Los_Angeles)", value: "America/Los_Angeles" }] },

  // Membership
  { key: "membership.min_age", value: 18, category: "membership", label: "Minimum Age", fieldType: "number" },
  { key: "membership.student_min_age", value: 18, category: "membership", label: "Student Min Age", fieldType: "number" },
  { key: "membership.student_max_age", value: 28, category: "membership", label: "Student Max Age", fieldType: "number" },
  { key: "membership.grace_period_days", value: 7, category: "membership", label: "Grace Period (days)", description: "Days after failed payment before status changes to PAST_DUE", fieldType: "number" },
  { key: "membership.suspension_days", value: 30, category: "membership", label: "Suspension Days", description: "Days in PAST_DUE before auto-suspension", fieldType: "number" },
  { key: "membership.auto_deactivate_keys_on_suspend", value: true, category: "membership", label: "Auto-deactivate Keys on Suspend", fieldType: "boolean" },
  { key: "membership.auto_reactivate_keys_on_payment", value: true, category: "membership", label: "Auto-reactivate Keys on Payment", fieldType: "boolean" },
  { key: "membership.allow_self_registration", value: false, category: "membership", label: "Allow Self-Registration", description: "Phase 2: enable public signup", fieldType: "boolean" },

  // Notifications
  { key: "notifications.renewal_reminder_days", value: [7, 3], category: "notifications", label: "Renewal Reminder Days", description: "Days before expiration to send reminders", fieldType: "json" },
  { key: "notifications.admin_overdue_digest_day", value: "monday", category: "notifications", label: "Overdue Digest Day", fieldType: "select", options: [{ label: "Monday", value: "monday" }, { label: "Tuesday", value: "tuesday" }, { label: "Wednesday", value: "wednesday" }, { label: "Thursday", value: "thursday" }, { label: "Friday", value: "friday" }] },
  { key: "notifications.admin_alert_emails", value: ["admin@melbournemakerspace.org"], category: "notifications", label: "Admin Alert Emails", fieldType: "json" },
  { key: "notifications.from_name", value: "Melbourne Makerspace", category: "notifications", label: "From Name", fieldType: "text" },
  { key: "notifications.enabled", value: true, category: "notifications", label: "Notifications Enabled", fieldType: "boolean" },

  // PayPal
  { key: "paypal.sync_enabled", value: false, category: "paypal", label: "PayPal Sync Enabled", fieldType: "boolean" },
  { key: "paypal.sync_interval_hours", value: 6, category: "paypal", label: "Sync Interval (hours)", fieldType: "number" },
  { key: "paypal.auto_match_by_email", value: true, category: "paypal", label: "Auto-match by Email", fieldType: "boolean" },

  // Dashboard
  { key: "dashboard.default_widgets", value: ["active_members", "revenue_summary", "overdue_accounts", "expiring_plans", "recent_activity", "growth_chart"], category: "dashboard", label: "Default Dashboard Widgets", fieldType: "json" },
];

// ─── Admin-excluded permissions for the Admin role ──────────────────────────

const adminExcludedPermissions = new Set([
  "roles.manage",
  "settings.manage",
  "bulk_actions.execute",
  "paypal.manage",
]);

// ─── Main seed function ─────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database...");

  // 1. Upsert all permissions
  console.log("Seeding permissions...");
  const permissionRecords = await Promise.all(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: { category: p.category, name: p.name, description: p.description },
        create: p,
      })
    )
  );
  console.log(`  ${permissionRecords.length} permissions seeded.`);

  // 2. Upsert roles
  console.log("Seeding roles...");

  const superAdminRole = await prisma.role.upsert({
    where: { name: "Super Admin" },
    update: { description: "Full system access", isSystem: true },
    create: { name: "Super Admin", description: "Full system access", isSystem: true },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: { description: "Administrative access", isSystem: true },
    create: { name: "Admin", description: "Administrative access", isSystem: true },
  });

  const memberRole = await prisma.role.upsert({
    where: { name: "Member" },
    update: { description: "Standard member access", isSystem: true },
    create: { name: "Member", description: "Standard member access", isSystem: true },
  });

  console.log(`  Roles seeded: ${superAdminRole.name}, ${adminRole.name}, ${memberRole.name}`);

  // 3. Assign permissions to roles
  console.log("Assigning permissions to roles...");

  // Super Admin gets ALL permissions
  for (const perm of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: perm.id },
    });
  }

  // Admin gets all permissions except excluded ones
  const adminPermissions = permissionRecords.filter((p) => !adminExcludedPermissions.has(p.key));
  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  // Member role gets NO permissions (portal access only)

  console.log(`  Super Admin: ${permissionRecords.length} permissions`);
  console.log(`  Admin: ${adminPermissions.length} permissions`);
  console.log(`  Member: 0 permissions`);

  // 4. Seed plans (Plan has no unique on name, so use findFirst + create/update)
  console.log("Seeding plans...");
  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          monthlyCost: plan.monthlyCost,
          keysIncluded: plan.keysIncluded,
          eligibleMembershipTypes: plan.eligibleMembershipTypes,
          isActive: true,
        },
      });
    } else {
      await prisma.plan.create({
        data: {
          name: plan.name,
          monthlyCost: plan.monthlyCost,
          keysIncluded: plan.keysIncluded,
          eligibleMembershipTypes: plan.eligibleMembershipTypes,
          isActive: true,
        },
      });
    }
  }
  console.log(`  ${plans.length} plans seeded.`);

  // 5. Upsert system settings
  console.log("Seeding system settings...");
  for (const setting of systemSettings) {
    const data = {
      value: setting.value as any,
      category: setting.category,
      label: setting.label,
      fieldType: setting.fieldType,
      ...("description" in setting && { description: (setting as any).description as string }),
      ...("options" in setting && { options: (setting as any).options as any }),
    };

    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: data,
      create: { key: setting.key, ...data },
    });
  }
  console.log(`  ${systemSettings.length} system settings seeded.`);

  // 6. Create Super Admin account
  console.log("Seeding super admin account...");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@melbournemakerspace.org";
  const passwordHash = await bcrypt.hash("changeme123", 10);

  await prisma.member.upsert({
    where: { email: adminEmail },
    update: {
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      roleId: superAdminRole.id,
      status: "ACTIVE",
    },
    create: {
      email: adminEmail,
      firstName: "Super",
      lastName: "Admin",
      passwordHash,
      roleId: superAdminRole.id,
      status: "ACTIVE",
      joinDate: new Date(),
    },
  });
  console.log(`  Super admin account seeded: ${adminEmail}`);

  console.log("Seeding complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
