import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

const PERMISSIONS: { key: string; category: string; name: string }[] = [
  { key: "members.view", category: "Members", name: "View members" },
  { key: "members.create", category: "Members", name: "Create members" },
  { key: "members.edit", category: "Members", name: "Edit members" },
  { key: "members.delete", category: "Members", name: "Delete members" },
  { key: "members.notes.view", category: "Members", name: "View staff notes" },
  { key: "members.notes.create", category: "Members", name: "Add staff notes" },
  { key: "members.invite", category: "Members", name: "Send invitations" },
  { key: "plans.view", category: "Plans", name: "View plans" },
  { key: "plans.manage", category: "Plans", name: "Manage plans" },
  { key: "plans.assign", category: "Plans", name: "Assign member plans" },
  { key: "keys.view", category: "Keys & Access", name: "View keys" },
  { key: "keys.manage", category: "Keys & Access", name: "Manage keys" },
  { key: "access.view", category: "Keys & Access", name: "View access logs" },
  { key: "transactions.view", category: "Transactions", name: "View transactions" },
  { key: "transactions.create", category: "Transactions", name: "Create transactions" },
  { key: "transactions.edit", category: "Transactions", name: "Edit transactions" },
  { key: "transactions.delete", category: "Transactions", name: "Delete transactions" },
  { key: "equipment.view", category: "Equipment", name: "View equipment" },
  { key: "equipment.manage", category: "Equipment", name: "Manage equipment" },
  { key: "equipment.certify", category: "Equipment", name: "Grant certifications" },
  { key: "equipment.maintenance", category: "Equipment", name: "Log maintenance" },
  { key: "waivers.view", category: "Waivers", name: "View waivers" },
  { key: "waivers.manage", category: "Waivers", name: "Manage waiver templates" },
  { key: "dashboard.view", category: "Dashboard & Reports", name: "View dashboard" },
  { key: "reports.view", category: "Dashboard & Reports", name: "View reports" },
  { key: "reports.export", category: "Dashboard & Reports", name: "Export reports" },
  { key: "notifications.send", category: "Notifications", name: "Send announcements" },
  { key: "notifications.manage", category: "Notifications", name: "Manage notifications" },
  { key: "settings.view", category: "Settings", name: "View settings" },
  { key: "settings.manage", category: "Settings", name: "Manage settings" },
  { key: "roles.view", category: "Roles", name: "View roles" },
  { key: "roles.manage", category: "Roles", name: "Manage roles" },
  { key: "bulk_actions.execute", category: "Bulk Actions", name: "Run bulk operations" },
];

// Admin gets everything except role/settings management and deletes
const ADMIN_EXCLUDED = new Set([
  "roles.manage",
  "settings.manage",
  "members.delete",
  "transactions.delete",
]);

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

function defaultSettings(rfidToken: string) {
  return [
    // Organization
    { key: "org.name", value: "Melbourne Makerspace", category: "Organization", label: "Organization name", fieldType: "text" },
    { key: "org.email", value: "admin@melbournemakerspace.org", category: "Organization", label: "Contact email", fieldType: "email" },
    { key: "org.website", value: "https://melbournemakerspace.org", category: "Organization", label: "Website", fieldType: "text" },
    { key: "org.address", value: "", category: "Organization", label: "Street address", fieldType: "text" },
    { key: "org.phone", value: "", category: "Organization", label: "Phone", fieldType: "text" },
    { key: "org.timezone", value: "America/New_York", category: "Organization", label: "Timezone", fieldType: "text" },
    // Membership lifecycle
    { key: "membership.grace_period_days", value: 7, category: "Membership", label: "Grace period (days)", description: "Days after a missed payment before status becomes Past Due.", fieldType: "number" },
    { key: "membership.suspension_days", value: 30, category: "Membership", label: "Suspension threshold (days)", description: "Days in Past Due before automatic suspension.", fieldType: "number" },
    { key: "membership.auto_deactivate_keys_on_suspend", value: true, category: "Membership", label: "Auto-deactivate keys on suspension", fieldType: "boolean" },
    { key: "membership.auto_reactivate_keys_on_payment", value: true, category: "Membership", label: "Auto-reactivate keys when active again", fieldType: "boolean" },
    { key: "membership.hold_keys_active", value: true, category: "Membership", label: "Keys stay active on Hold", fieldType: "boolean" },
    // Notifications
    { key: "notifications.enabled", value: true, category: "Notifications", label: "Email notifications enabled", fieldType: "boolean" },
    { key: "notifications.renewal_reminder_days", value: [7, 3], category: "Notifications", label: "Renewal reminder days", description: "Days before plan end date to send reminders.", fieldType: "json" },
    { key: "notifications.admin_alert_emails", value: ["admin@melbournemakerspace.org"], category: "Notifications", label: "Admin alert emails", fieldType: "json" },
    { key: "notifications.overdue_digest_day", value: "monday", category: "Notifications", label: "Overdue digest day", fieldType: "select", options: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] },
    { key: "notifications.from_name", value: "Melbourne Makerspace", category: "Notifications", label: "From name", fieldType: "text" },
    // RFID / access control
    { key: "rfid.api_token", value: rfidToken, category: "RFID Access", label: "RFID API token", description: "Bearer token the RFIDLock reader uses to fetch the whitelist and post access events.", fieldType: "text" },
    { key: "rfid.allowed_statuses", value: ["ACTIVE", "HOLD"], category: "RFID Access", label: "Statuses allowed entry", description: "Member statuses whose active keys appear on the door whitelist.", fieldType: "json" },
    { key: "rfid.require_waivers", value: false, category: "RFID Access", label: "Require completed waivers for entry", description: "Exclude members missing a required waiver from the whitelist.", fieldType: "boolean" },
  ];
}

// ---------------------------------------------------------------------------
// Default liability waiver
// ---------------------------------------------------------------------------

const LIABILITY_WAIVER = `RELEASE OF LIABILITY, WAIVER OF CLAIMS, AND ASSUMPTION OF RISK AGREEMENT

In consideration of being permitted to enter and use the facilities, tools, and equipment of Melbourne Makerspace ("the Makerspace"), I agree as follows:

1. ASSUMPTION OF RISK. I understand that the use of tools, machinery, and equipment — including but not limited to woodworking tools, metalworking tools, laser cutters, 3D printers, CNC machines, and electrical equipment — involves inherent risks of serious injury, including permanent disability and death. I voluntarily assume all risks associated with my presence at and use of the Makerspace.

2. SAFETY RULES. I agree to follow all posted safety rules, complete required equipment certifications before operating restricted equipment, use appropriate personal protective equipment, and follow the directions of Makerspace staff and volunteers.

3. RELEASE AND WAIVER. To the fullest extent permitted by law, I release, waive, and discharge Melbourne Makerspace, its directors, officers, volunteers, members, and agents from any and all liability, claims, demands, or causes of action arising out of or related to any loss, damage, or injury that may be sustained by me or my property while at the Makerspace.

4. INDEMNIFICATION. I agree to indemnify and hold harmless the Makerspace from any loss, liability, damage, or cost that may arise from my presence at or use of the facilities.

5. MEDICAL TREATMENT. I consent to receive medical treatment deemed necessary if I am injured while at the Makerspace, and I accept responsibility for the costs of such treatment.

6. ACKNOWLEDGMENT. I have read this agreement, fully understand its terms, and understand that I am giving up substantial rights by signing it. I sign it freely and voluntarily.`;

// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Cubit database...");

  // Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { category: p.category, name: p.name },
      create: p,
    });
  }
  console.log(`  ${PERMISSIONS.length} permissions`);

  // Roles
  const superAdmin = await prisma.role.upsert({
    where: { name: "Super Admin" },
    update: {},
    create: { name: "Super Admin", description: "Full system access", isSystem: true },
  });
  const admin = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin", description: "Day-to-day management access", isSystem: true },
  });
  const memberRole = await prisma.role.upsert({
    where: { name: "Member" },
    update: {},
    create: { name: "Member", description: "Self-service portal access", isSystem: true },
  });

  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdmin.id, permissionId: perm.id },
    });
    if (!ADMIN_EXCLUDED.has(perm.key)) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: admin.id, permissionId: perm.id } },
        update: {},
        create: { roleId: admin.id, permissionId: perm.id },
      });
    }
  }
  console.log("  roles: Super Admin, Admin, Member");

  // Plans
  const plans: [string, number, number, ("STANDARD" | "STUDENT" | "SCHOLARSHIP" | "SPONSORSHIP")[]][] = [
    ["Standard Membership", 60, 1, ["STANDARD", "SPONSORSHIP"]],
    ["Student Membership (18-28)", 30, 1, ["STUDENT"]],
    ["Standard + 1 Key", 90, 2, ["STANDARD"]],
    ["Standard + 2 Keys", 120, 3, ["STANDARD"]],
    ["Standard + 3 Keys", 150, 4, ["STANDARD"]],
    ["Scholarship", 0, 1, ["SCHOLARSHIP"]],
  ];
  for (const [name, cost, keys, types] of plans) {
    const existing = await prisma.plan.findFirst({ where: { name } });
    if (!existing) {
      await prisma.plan.create({
        data: { name, monthlyCost: cost, keysIncluded: keys, eligibleMembershipTypes: types },
      });
    }
  }
  console.log(`  ${plans.length} plans`);

  // System settings (only create; never clobber admin-edited values)
  const rfidToken = crypto.randomBytes(24).toString("hex");
  for (const s of defaultSettings(rfidToken)) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { label: s.label, category: s.category, description: s.description ?? null, fieldType: s.fieldType, options: s.options ?? undefined },
      create: {
        key: s.key,
        value: s.value as object,
        category: s.category,
        label: s.label,
        description: s.description ?? null,
        fieldType: s.fieldType,
        options: s.options ?? undefined,
      },
    });
  }
  console.log("  system settings");

  // Default required waiver
  const existingWaiver = await prisma.waiverTemplate.findFirst({
    where: { name: "General Liability Waiver" },
  });
  if (!existingWaiver) {
    await prisma.waiverTemplate.create({
      data: {
        name: "General Liability Waiver",
        description: "Required release of liability and assumption of risk for all members.",
        content: LIABILITY_WAIVER,
        isRequired: true,
      },
    });
  }
  console.log("  default liability waiver");

  // Super admin accounts
  const passwordHash = await bcrypt.hash("changeme123", 10);
  const admins = [
    { email: process.env.ADMIN_EMAIL || "admin@melbournemakerspace.org", firstName: "Makerspace", lastName: "Admin" },
    { email: "albersnoah@gmail.com", firstName: "Noah", lastName: "Albers" },
  ];
  for (const a of admins) {
    await prisma.member.upsert({
      where: { email: a.email },
      update: { roleId: superAdmin.id, status: "ACTIVE" },
      create: {
        ...a,
        passwordHash,
        roleId: superAdmin.id,
        status: "ACTIVE",
        joinDate: new Date(),
      },
    });
    console.log(`  super admin: ${a.email}`);
  }

  // Ensure memberRole is referenced so linters don't complain
  void memberRole;

  console.log("Seed complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
