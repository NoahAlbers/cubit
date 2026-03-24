# Cubit — Makerspace Member Management System

## Implementation Specification

**Project**: Cubit (replaces legacy system "Tonic" for Melbourne Makerspace)
**Stack**: Next.js 14+ (App Router), TypeScript, PostgreSQL, Prisma, NextAuth.js, Tailwind CSS, Resend
**Deployment**: Vercel

---

## 1. Project overview

Cubit is a full-featured CRM for Melbourne Makerspace (Melbourne, FL). It replaces an outdated Angular 11 frontend that has no member portal, no notifications, no billing integration, no dashboard, and broken image uploads.

Cubit connects to the makerspace's existing PayPal recurring billing (does NOT replace it), adds a member self-service portal, automated email notifications, management dashboards, equipment/certification tracking, and waiver management.

### What Cubit is NOT
- Not a billing system. PayPal handles recurring charges. Cubit syncs that data.
- Not replacing how members subscribe. They still click the PayPal button on the website.

### Brand colors
- White: `#FAFAFA`
- Blue (primary): `#094FA4`
- Red (accent): `#C5122F`

Mobile-first responsive design. Members will primarily use phones; admins will use desktop/tablet.

---

## 2. Tech stack details

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14+ App Router, TypeScript, Tailwind CSS | Server components by default, client only where needed |
| Backend | Next.js Route Handlers + Server Actions | No separate API server |
| Database | PostgreSQL + Prisma ORM | Use Prisma client singleton pattern |
| Auth | NextAuth.js | Email/password + magic link providers |
| Email | Resend + React Email | Transactional emails with branded templates |
| Payments | PayPal API (primary) | Research best method: webhooks, Sync API, or Subscriptions API |
| Documents | DocuSeal (future) | Schema fields only for now, no integration code |
| Validation | Zod | Shared schemas between client and server |
| Dates | date-fns | Store UTC, display local timezone |
| Deployment | Vercel | Push-to-deploy from GitHub |
| File Storage | Vercel Blob or S3-compatible | Member photos, uploaded documents |

### Environment variables (.env.example)

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@melbournemakerspace.org
ADMIN_EMAIL=admin@melbournemakerspace.org
NEXT_PUBLIC_APP_URL=

# Phase 2 - PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=

# Future - DocuSeal
DOCUSEAL_API_KEY=
DOCUSEAL_BASE_URL=

# Future - Stripe (optional alternative to PayPal)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 3. Authentication & dynamic role system

### 3.1 Auth flows

**Standard login**: Email + password via NextAuth credentials provider.

**Magic link**: Passwordless email login. Used for bulk onboarding of existing members. If no password is set on the account, the user is prompted to create one after clicking the magic link.

**Admin invite**: Admin creates a member record → system sends magic link invitation → member clicks link → sets password → account activated.

**Self-registration (Phase 2)**: Public signup page. Creates account in PROSPECTIVE status. Admin reviews and activates.

**Password reset**: Forgot-password flow via Resend with time-limited reset token.

### 3.2 Dynamic permission-based role system

The role system is NOT a hardcoded enum. Super admins can create, edit, and delete custom roles and assign granular permissions to each role. This is a core differentiator — the makerspace should be able to create roles like "Front Desk Volunteer", "Treasurer", "Equipment Manager", etc. with exactly the permissions they need.

**Default roles (seeded on first run, editable afterward):**

| Role | Description | Deletable? |
|------|-------------|-----------|
| Super Admin | Full system access including role/permission management and system settings. | No (system role) |
| Admin | Standard admin access: manage members, plans, keys, transactions, equipment, view dashboard. | No (system role) |
| Member | Self-service portal access only. View own data, edit own profile. | No (system role) |

Super admins can create additional roles (e.g., "Treasurer", "Front Desk", "Equipment Manager", "Board Member") and assign any combination of permissions.

**Permission categories and granular permissions:**

```
members.view          - View member list and profiles
members.create        - Create new member records
members.edit          - Edit member profiles and status
members.delete        - Delete/archive member records
members.notes.view    - View staff notes on members
members.notes.create  - Add staff notes to members
members.invite        - Send magic link invitations

plans.view            - View plans
plans.manage          - Create, edit, deactivate plans
plans.assign          - Assign/modify member plan assignments

keys.view             - View key assignments
keys.manage           - Add, remove, activate, deactivate keys

transactions.view     - View transaction history
transactions.create   - Manually create transactions
transactions.edit     - Edit existing transactions
transactions.delete   - Delete transactions

equipment.view        - View equipment inventory
equipment.manage      - Add, edit, retire equipment
equipment.certify     - Grant/revoke member certifications
equipment.maintenance - Log maintenance entries

waivers.view          - View waiver status
waivers.manage        - Create/edit waiver templates, mark complete

dashboard.view        - View admin dashboard
dashboard.configure   - Customize dashboard widget layout

reports.view          - View reports
reports.export        - Export reports (CSV, PDF)

notifications.send    - Send bulk notifications/announcements
notifications.manage  - Manage notification templates and settings

settings.view         - View system settings
settings.manage       - Modify system settings

roles.view            - View roles and permissions
roles.manage          - Create, edit, delete roles and assign permissions

bulk_actions.execute  - Run bulk operations (batch status changes, key deactivation, etc.)

paypal.view           - View PayPal sync status and unmatched transactions
paypal.manage         - Link unmatched transactions, configure PayPal settings
```

The Super Admin system role always has ALL permissions and this cannot be changed. The Admin system role has a sensible default set that can be customized. The Member system role has only self-service permissions and cannot be given admin permissions.

### 3.3 Data model for roles/permissions

```prisma
model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false)  // true for Super Admin, Admin, Member — cannot be deleted
  permissions RolePermission[]
  members     Member[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Permission {
  id          String   @id @default(uuid())
  key         String   @unique  // e.g., "members.view", "plans.manage"
  category    String              // e.g., "members", "plans", "keys"
  name        String              // Human-readable: "View members"
  description String?
  roles       RolePermission[]
}

model RolePermission {
  id           String     @id @default(uuid())
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId])
}
```

### 3.4 Auth middleware

Create a `withPermission` middleware/wrapper that:
1. Checks the user's session exists
2. Looks up the user's role
3. Checks if the role has the required permission(s)
4. Returns 403 if not authorized
5. For member-role users accessing their own data, verifies the resource belongs to them

Example usage:
```typescript
// In a route handler
export async function GET(req: Request) {
  await requirePermission(req, "members.view");
  // ... handler logic
}

// In a server action
export async function updateMember(formData: FormData) {
  await requirePermission("members.edit");
  // ... action logic
}
```

---

## 4. System settings & dashboard configuration

### 4.1 System settings

Super admins (and users with `settings.manage` permission) can configure system-wide settings via an admin Settings page. Store as key-value pairs in the database.

```prisma
model SystemSetting {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json                // Flexible JSON value
  category  String              // For grouping in settings UI
  label     String              // Human-readable label
  description String?
  fieldType String   @default("text")  // text, number, boolean, select, email, json
  options   Json?               // For select fields: [{ label, value }]
  updatedAt DateTime @updatedAt
  updatedBy String?             // Member ID of who last changed it
}
```

**Setting categories and default values to seed:**

**Organization settings:**
- `org.name` = "Melbourne Makerspace"
- `org.email` = "admin@melbournemakerspace.org"
- `org.website` = "https://melbournemakerspace.org"
- `org.address` = (to be filled)
- `org.phone` = (to be filled)
- `org.logo_url` = (to be filled)
- `org.timezone` = "America/New_York"

**Membership settings:**
- `membership.min_age` = 18
- `membership.student_min_age` = 18
- `membership.student_max_age` = 28
- `membership.grace_period_days` = 7 (days after failed payment before status changes to PAST_DUE)
- `membership.suspension_days` = 30 (days in PAST_DUE before auto-suspension)
- `membership.auto_deactivate_keys_on_suspend` = true
- `membership.auto_reactivate_keys_on_payment` = true
- `membership.allow_self_registration` = false (Phase 2: set to true)

**Notification settings:**
- `notifications.renewal_reminder_days` = [7, 3] (days before expiration to send reminders)
- `notifications.admin_overdue_digest_day` = "monday" (day of week for overdue digest)
- `notifications.admin_alert_emails` = ["admin@melbournemakerspace.org"]
- `notifications.from_name` = "Melbourne Makerspace"
- `notifications.enabled` = true

**PayPal settings (Phase 2):**
- `paypal.sync_enabled` = false
- `paypal.sync_interval_hours` = 6
- `paypal.auto_match_by_email` = true

**Dashboard settings:**
- `dashboard.default_widgets` = ["active_members", "revenue_summary", "overdue_accounts", "expiring_plans", "recent_activity", "growth_chart"]

### 4.2 Admin dashboard configuration

Each admin user can customize their own dashboard layout. The system provides a set of available widgets; admins with `dashboard.configure` permission can choose which ones to display and arrange them.

```prisma
model DashboardConfig {
  id        String   @id @default(uuid())
  memberId  String   @unique
  member    Member   @relation(fields: [memberId], references: [id])
  widgets   Json     // Array of { widgetId, position, size, config }
  updatedAt DateTime @updatedAt
}
```

**Available dashboard widgets:**

| Widget ID | Name | Description | Default config |
|-----------|------|-------------|---------------|
| `active_members` | Active member count | Count with trend arrow vs last month | `{ compareMonths: 1 }` |
| `growth_chart` | Member growth | Line chart of active members over time | `{ months: 12 }` |
| `revenue_summary` | Revenue summary | Bar chart of monthly revenue | `{ months: 12 }` |
| `revenue_forecast` | Revenue forecast | Projected revenue based on active plans | `{ months: 3 }` |
| `churn_rate` | Churn rate | Cancellation percentage | `{ periods: [30, 90, 365] }` |
| `overdue_accounts` | Overdue accounts | Table of PAST_DUE and SUSPENDED members | `{ limit: 10 }` |
| `expiring_plans` | Expiring plans | Members whose plans end within N days | `{ days: 30 }` |
| `recent_activity` | Recent activity | Feed of latest signups, payments, changes | `{ limit: 15 }` |
| `key_status` | Key status summary | Active/inactive/lost key counts | `{}` |
| `waiver_compliance` | Waiver compliance | Members missing required waivers | `{ limit: 10 }` |
| `equipment_status` | Equipment status | Machines needing maintenance or out of order | `{}` |
| `certification_summary` | Certifications | Recent certifications granted | `{ limit: 10 }` |

Dashboard should use a responsive grid layout. Widgets can be toggled on/off and reordered. Each widget can have its own config overrides (e.g., change the growth chart from 12 months to 6).

The Settings page should have a "Dashboard" tab where users can:
- Toggle widgets on/off
- Drag to reorder
- Configure per-widget settings (timeframes, limits)
- Reset to system defaults

---

## 5. Complete Prisma schema

Create the full `schema.prisma` with all tables below. All tables include `id` (UUID), `createdAt`, `updatedAt` unless noted.

### 5.1 Member

```prisma
enum MemberStatus {
  PROSPECTIVE
  ACTIVE
  HOLD
  PAST_DUE
  SUSPENDED
  CANCELED
  ALUMNI
}

enum MembershipType {
  STANDARD
  STUDENT
  SCHOLARSHIP
  SPONSORSHIP
}

model Member {
  id                    String         @id @default(uuid())
  email                 String         @unique
  passwordHash          String?
  firstName             String
  lastName              String
  phone                 String?
  paypalEmail           String?
  paypalSubscriptionId  String?
  emergencyContactName  String?
  emergencyContactEmail String?
  emergencyContactPhone String?
  picture               String?
  roleId                String
  role                  Role           @relation(fields: [roleId], references: [id])
  status                MemberStatus   @default(PROSPECTIVE)
  statusReason          String?
  membershipType        MembershipType @default(STANDARD)
  dateOfBirth           DateTime?
  joinDate              DateTime?
  referredById          String?
  referredBy            Member?        @relation("Referrals", fields: [referredById], references: [id])
  referrals             Member[]       @relation("Referrals")
  lastLoginAt           DateTime?
  magicLinkToken        String?
  magicLinkExpires      DateTime?
  resetToken            String?
  resetTokenExpires     DateTime?

  // Relations
  plans                  MemberPlan[]
  keys                   Key[]
  transactions           Transaction[]
  notes                  MemberNote[]           @relation("MemberNotes")
  authoredNotes          MemberNote[]           @relation("AuthoredNotes")
  notifications          Notification[]
  notificationPreferences NotificationPreference[]
  certifications         EquipmentCertification[] @relation("CertifiedMember")
  certifiedOthers        EquipmentCertification[] @relation("Certifier")
  waivers                MemberWaiver[]
  maintenanceLogs        MaintenanceLog[]
  accessLogs             AccessLog[]
  dashboardConfig        DashboardConfig?
  hostedGuests           Guest[]

  // Future - Stripe
  stripeCustomerId       String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.2 Plan

```prisma
model Plan {
  id                     String           @id @default(uuid())
  name                   String
  description            String?
  monthlyCost            Decimal          @db.Decimal(10, 2)
  keysIncluded           Int              @default(1)
  isActive               Boolean          @default(true)
  eligibleMembershipTypes MembershipType[]
  paypalPlanId           String?
  stripePriceId          String?          // Future

  memberPlans MemberPlan[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Seed data:**

| Name | Monthly cost | Keys | Eligible types |
|------|-------------|------|---------------|
| Standard Membership | $60.00 | 1 | STANDARD, SPONSORSHIP |
| Student Membership (18-28) | $30.00 | 1 | STUDENT |
| Standard + 1 Key | $90.00 | 2 | STANDARD |
| Standard + 2 Keys | $120.00 | 3 | STANDARD |
| Standard + 3 Keys | $150.00 | 4 | STANDARD |
| Scholarship | $0.00 | 1 | SCHOLARSHIP |

### 5.3 MemberPlan

```prisma
model MemberPlan {
  id        String    @id @default(uuid())
  memberId  String
  planId    String
  startDate DateTime
  endDate   DateTime?
  member    Member    @relation(fields: [memberId], references: [id])
  plan      Plan      @relation(fields: [planId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Business rule: Only one MemberPlan without an endDate is allowed per member. Enforce in application logic.

### 5.4 Key

```prisma
enum KeyStatus {
  ACTIVE
  INACTIVE
  LOST
  RETURNED
}

model Key {
  id              String    @id @default(uuid())
  serialNumber    String    @unique
  memberId        String
  member          Member    @relation(fields: [memberId], references: [id])
  status          KeyStatus @default(ACTIVE)
  type            String?   // "fob", "card"
  assignedDate    DateTime?
  deactivatedDate DateTime?
  accessLogs      AccessLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.5 Transaction

```prisma
enum PaymentMethod {
  PAYPAL
  CASH
  CHECK
  CREDIT_CARD
  STRIPE
  OTHER
}

enum TransactionSource {
  MANUAL
  PAYPAL_SYNC
  STRIPE_WEBHOOK
}

model Transaction {
  id                  String            @id @default(uuid())
  memberId            String
  member              Member            @relation(fields: [memberId], references: [id])
  amount              Decimal           @db.Decimal(10, 2)
  transactionDate     DateTime
  description         String?
  method              PaymentMethod     @default(OTHER)
  confirmation        String?
  paypalTransactionId String?
  source              TransactionSource @default(MANUAL)
  notes               String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.6 MemberNote

```prisma
model MemberNote {
  id        String   @id @default(uuid())
  memberId  String
  member    Member   @relation("MemberNotes", fields: [memberId], references: [id])
  authorId  String
  author    Member   @relation("AuthoredNotes", fields: [authorId], references: [id])
  content   String   @db.Text
  isPinned  Boolean  @default(false)
  isSystem  Boolean  @default(false)  // true for auto-generated notes (status changes, etc.)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.7 Notification

```prisma
enum NotificationType {
  WELCOME
  MAGIC_LINK
  PAYMENT_RECEIPT
  PAYMENT_FAILED
  RENEWAL_REMINDER
  PLAN_EXPIRING
  KEY_DEACTIVATED
  PASSWORD_RESET
  ADMIN_NEW_SIGNUP
  ADMIN_PAYMENT_FAILED
  ADMIN_OVERDUE_DIGEST
  ANNOUNCEMENT
}

enum NotificationChannel {
  EMAIL
  IN_APP   // Future
  SMS      // Future
}

enum NotificationStatus {
  QUEUED
  SENT
  FAILED
  BOUNCED
}

model Notification {
  id              String             @id @default(uuid())
  memberId        String
  member          Member             @relation(fields: [memberId], references: [id])
  type            NotificationType
  channel         NotificationChannel @default(EMAIL)
  subject         String?
  status          NotificationStatus  @default(QUEUED)
  sentAt          DateTime?
  resendMessageId String?
  errorMessage    String?

  createdAt DateTime @default(now())
}

model NotificationPreference {
  id               String           @id @default(uuid())
  memberId         String
  member           Member           @relation(fields: [memberId], references: [id])
  notificationType NotificationType
  enabled          Boolean          @default(true)

  @@unique([memberId, notificationType])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.8 Equipment & certifications

```prisma
enum EquipmentStatus {
  OPERATIONAL
  MAINTENANCE
  OUT_OF_ORDER
  RETIRED
}

model Equipment {
  id                    String          @id @default(uuid())
  name                  String
  description           String?
  location              String?
  status                EquipmentStatus @default(OPERATIONAL)
  requiresCertification Boolean         @default(false)
  category              String?
  serialNumber          String?
  purchaseDate          DateTime?
  warrantyExpiration    DateTime?
  photoUrl              String?

  certifications EquipmentCertification[]
  maintenanceLogs MaintenanceLog[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model EquipmentCertification {
  id             String    @id @default(uuid())
  memberId       String
  member         Member    @relation("CertifiedMember", fields: [memberId], references: [id])
  equipmentId    String
  equipment      Equipment @relation(fields: [equipmentId], references: [id])
  certifiedDate  DateTime
  certifiedById  String?
  certifiedBy    Member?   @relation("Certifier", fields: [certifiedById], references: [id])
  expirationDate DateTime?
  notes          String?

  @@unique([memberId, equipmentId])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MaintenanceLog {
  id              String    @id @default(uuid())
  equipmentId     String
  equipment       Equipment @relation(fields: [equipmentId], references: [id])
  performedById   String?
  performedBy     Member?   @relation(fields: [performedById], references: [id])
  maintenanceDate DateTime
  description     String    @db.Text
  nextDueDate     DateTime?
  cost            Decimal?  @db.Decimal(10, 2)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.9 Waivers

```prisma
enum WaiverStatus {
  PENDING
  COMPLETED
  EXPIRED
}

model WaiverTemplate {
  id                 String         @id @default(uuid())
  name               String
  description        String?
  isRequired         Boolean        @default(false)
  isActive           Boolean        @default(true)
  docusealTemplateId String?        // Future: DocuSeal integration

  memberWaivers MemberWaiver[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model MemberWaiver {
  id                   String       @id @default(uuid())
  memberId             String
  member               Member       @relation(fields: [memberId], references: [id])
  waiverId             String
  waiver               WaiverTemplate @relation(fields: [waiverId], references: [id])
  status               WaiverStatus @default(PENDING)
  completedDate        DateTime?
  documentUrl          String?      // Uploaded PDF URL
  docusealSubmissionId String?      // Future: DocuSeal

  expirationDate DateTime?

  @@unique([memberId, waiverId])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 5.10 Future-proofing tables (schema only — do NOT build UI or API)

```prisma
enum AccessType {
  ENTRY
  EXIT
  DENIED
}

model AccessLog {
  id          String     @id @default(uuid())
  memberId    String?
  member      Member?    @relation(fields: [memberId], references: [id])
  keyId       String?
  key         Key?       @relation(fields: [keyId], references: [id])
  accessPoint String?
  accessType  AccessType
  timestamp   DateTime   @default(now())
  rawData     Json?
}

model Guest {
  id           String   @id @default(uuid())
  name         String
  email        String?
  hostMemberId String?
  host         Member?  @relation(fields: [hostMemberId], references: [id])
  visitDate    DateTime
  purpose      String?
  waiverSigned Boolean  @default(false)

  createdAt DateTime @default(now())
}
```

---

## 6. Member status lifecycle

Every status transition must be logged as a system MemberNote.

| Status | Trigger | Effects |
|--------|---------|---------|
| PROSPECTIVE | Self-registration or admin creates before orientation | Cannot access member portal beyond basic profile. No keys. |
| ACTIVE | Admin activates after orientation + key, or PayPal sub detected | Full access. Keys active. Portal functional. |
| HOLD | Member requests pause, or admin sets manually | Keys active (configurable via settings). No billing reminders. |
| PAST_DUE | PayPal payment fails after grace period (configurable, default 7 days) | Keys stay active during grace. Payment failed notification sent. Shows on overdue dashboard. |
| SUSPENDED | PAST_DUE for N days (configurable, default 30), or admin manually suspends | Keys auto-deactivated (if setting enabled). Notification sent. Portal shows suspension message. |
| CANCELED | Member or admin cancels | Keys deactivated, marked RETURNED. Plan end-dated. Record retained. |
| ALUMNI | Admin transitions canceled member | Historical record. Reactivatable. Excluded from active counts. |

All thresholds (grace period days, suspension days, auto-deactivate behavior) are controlled via System Settings, not hardcoded.

---

## 7. Feature specifications

### 7.1 Admin: Member list

Primary admin landing page (until dashboard is built in Phase 3).

- Server-side paginated table (25, 50, 100 per page)
- Search by first name, last name, or email (server-side, debounced 400ms)
- Filter by: status (multi-select), membership type (multi-select)
- Sort by: name, join date, status, last login
- Show/hide inactive toggle (defaults to active only)
- Active member count in header
- Click row → member detail
- "Add Member" button
- Bulk select checkboxes (wire now, full bulk actions in Phase 3)

### 7.2 Admin: Member detail

Organized into collapsible card sections.

**Profile card:**
- First name, last name, email, phone, PayPal email, membership type, date of birth, join date
- Profile photo upload and display
- QR code generated from member ID

**Emergency contact card:**
- Name, email, phone

**Status card:**
- Current status with color badge (green=active, yellow=hold, orange=past due, red=suspended/canceled)
- Status change dropdown + reason text field
- Status changes auto-logged as system notes

**Plans card:**
- Table: plan name, cost, start date, end date
- Add plan: select from dropdown, set start date, optional end date
- Enforce: only one open (no end date) plan per member
- Edit plan: set end date

**Keys card:**
- Table: serial number, type, status toggle, assigned date
- Add key button
- Delete key with confirmation dialog
- Show count vs plan allowance (e.g., "2 of 2 keys")

**Payment history card:**
- Table: date, amount, description, method, source (manual/PayPal sync), confirmation
- Running balance in header
- Add transaction: date (default today), amount, method dropdown (Cash, PayPal, Credit Card, Check, Other), confirmation, description, notes

**Notes card:**
- Chronological list with author name and timestamp
- Add note textarea
- Pin/unpin toggle
- System-generated notes (status changes) shown with a different style
- Admin-only: members never see these

**Waivers card:**
- List of all waiver templates with per-member completion status
- Admin can mark as completed with date
- Future: upload PDF, DocuSeal signing button

**Certifications card:**
- Equipment member is certified on, with date and certifier name
- Add certification: select equipment dropdown, set date, optional notes

**Save:** Profile and emergency contact save together. Other cards have independent save actions.

### 7.3 Admin: Equipment management

Sidebar nav item.

**Equipment list:**
- Paginated table, searchable by name
- Filter by: status, category, requires certification
- Click row → detail

**Equipment detail:**
- Fields: name, description, location, category, serial number, purchase date, warranty expiration, photo upload, status dropdown, requires certification toggle
- Certified members list with dates
- Add certification for a member
- Maintenance log entries: date, description, performed by, cost, next due date
- Add maintenance entry form

### 7.4 Admin: Waiver template management

- List all waiver templates
- Create new: name, description, required flag, active toggle
- Edit existing
- View which members have/haven't completed each waiver

### 7.5 Admin: Bulk magic-link invite

- Page showing all members who have never logged in (no password set, lastLoginAt is null)
- Select individual members or "Invite All"
- Preview recipient list before sending
- Confirmation dialog with count
- Progress indicator during send
- Results summary: sent/failed counts

### 7.6 Admin: Role & permission management

Requires `roles.manage` permission. Located in Settings.

- List all roles with member count per role
- Create new role: name, description, select permissions via categorized checkbox grid
- Edit role: modify name, description, permissions
- Delete role: only if not a system role and no members assigned. Prompt to reassign members first.
- Permission grid organized by category (Members, Plans, Keys, Transactions, Equipment, etc.)
- Preview: "This role can: view members, manage keys, view dashboard"

### 7.7 Admin: System settings

Requires `settings.manage` permission.

- Settings organized by category tabs: Organization, Membership, Notifications, PayPal, Dashboard
- Each setting shows: label, description, current value, input appropriate to fieldType
- Save per-category or per-setting
- Audit: show who last changed each setting and when

### 7.8 Member portal: Dashboard

Clean, mobile-first landing page after login.

- Welcome with first name
- Status badge prominently displayed
- Current plan name and cost
- Account balance
- Key status summary: "Your key is active" or "Your key is inactive — contact staff"
- Quick links: payment history, edit profile, certifications, waivers
- Alert area for pending items (unsigned waivers, upcoming renewal)

### 7.9 Member portal: Profile

- Editable: first name, last name, phone (email change requires verification)
- Editable: emergency contact name, email, phone
- Profile photo upload
- Read-only: membership type, join date, status, role
- Password change (current + new + confirm)

### 7.10 Member portal: Payment history

- Paginated table: date, amount, description, method
- Running balance
- Read-only (members cannot edit transactions)

### 7.11 Member portal: Certifications & waivers

- List of equipment certifications with dates
- List of required waivers with completion status
- Future: "Sign waiver" button for DocuSeal

### 7.12 Member portal: Notification preferences

- List of notification types with toggle on/off
- Default is opted-in for all

---

## 8. PayPal integration (Phase 2)

Melbourne Makerspace uses PayPal recurring billing. Members subscribe via a PayPal button on the makerspace website. Cubit does NOT replace this — it syncs the data.

### Implementation approach

Research which PayPal API is available for the makerspace's PayPal Business account:

**Preferred: PayPal Webhooks**
- Register for: PAYMENT.SALE.COMPLETED, PAYMENT.SALE.DENIED, BILLING.SUBSCRIPTION.CREATED, BILLING.SUBSCRIPTION.CANCELLED, BILLING.SUBSCRIPTION.SUSPENDED
- On webhook, match payer email to Member.paypalEmail
- If matched: create Transaction record, update member status as needed
- If not matched: store in unmatched queue for admin review

**Fallback: PayPal Sync API**
- Cron job (configurable interval, default 6 hours) pulls recent transactions
- Same matching logic as webhooks

### Unmatched transactions page

- Admin page showing PayPal transactions that couldn't be auto-matched
- Admin can: link to existing member (search by name/email), create new member from transaction, dismiss (e.g., donation)
- Once linked, transaction record is created on the member

### Auto-matching logic

1. Check Transaction.paypalEmail against Member.paypalEmail (exact match)
2. If no match, check against Member.email
3. If still no match, queue as unmatched
4. Admin can manually link and optionally update the member's paypalEmail for future auto-matching

---

## 9. Notification system (Phase 2)

Event-driven email pipeline using Resend and React Email.

### Architecture

A notification service module that:
1. Receives event type + member ID + optional data
2. Checks member's NotificationPreference for that type
3. Checks system setting `notifications.enabled`
4. Renders the appropriate React Email template
5. Sends via Resend
6. Creates Notification record with status

### Email templates

All templates branded with Melbourne Makerspace colors (#094FA4, #C5122F, #FAFAFA) and logo. Mobile-responsive. Plain text fallback.

Common elements:
- Logo header
- Clean layout
- Footer: makerspace address, notification preferences link
- Blue primary action buttons

| Template | Trigger | Key content |
|----------|---------|-------------|
| Welcome | Account created | Name, magic link, portal overview |
| Magic link | Login request | Link, 24hr expiry, "didn't request?" |
| Payment receipt | PayPal sync | Amount, date, method, balance, history link |
| Payment failed | PayPal webhook | Amount, PayPal update instructions, support contact |
| Renewal reminder | Cron: 7 and 3 days before | Plan name, cost, renewal date |
| Plan expired | Cron: plan end date | Re-subscribe instructions |
| Key deactivated | Key status change | Serial, reason, contact staff |
| Password reset | Reset request | Link (1hr expiry), "didn't request?" |
| Admin: new signup | Self-registration | New member name/email, profile link |
| Admin: payment failed | PayPal webhook | Member name, amount, profile link |
| Admin: overdue digest | Weekly cron | List of overdue members with days and balances |

### Auto-actions (triggered by events or cron)

- Payment fails → wait grace period (configurable) → set PAST_DUE
- PAST_DUE for N days (configurable) → set SUSPENDED → deactivate keys (if setting enabled)
- Payment received for PAST_DUE/SUSPENDED → set ACTIVE → reactivate keys (if setting enabled)
- Cron: check for plans expiring within reminder window → send renewal reminders
- Cron: weekly overdue digest to admin emails

---

## 10. Dashboard & reporting (Phase 3)

### Dashboard

See Section 4.2 for the widget system. Dashboard becomes the admin landing page (member list moves to sidebar nav).

Each widget fetches its own data via a server component or API route. Widgets render with loading skeletons during fetch.

### Reporting & export

Requires `reports.view` / `reports.export` permission.

- Member roster: CSV with all fields, filterable by status and type
- Transaction report: CSV with date range, grouped by member or month
- Revenue summary: PDF formatted for board meetings (growth, revenue, churn)
- Overdue report: CSV of past-due and suspended with days overdue and contact info
- Equipment report: CSV with status, certification counts, next maintenance
- Waiver compliance: which members are missing required waivers

### Bulk operations

Requires `bulk_actions.execute` permission.

- Send renewal reminder to members expiring within N days
- Deactivate keys for all SUSPENDED members
- Reactivate keys for members returned to ACTIVE
- Batch status change with reason
- Send custom announcement to selected or all active members
- Confirmation dialog with affected count before execution

---

## 11. Data migration (Phase 2)

Import existing member data from the current Tonic system.

- Admin-only import page accepting CSV or JSON
- Field mapping: first name, last name, email, phone, PayPal email, status, plan, key serials
- Creates member records in ACTIVE status with no password
- Duplicate email detection, required field validation, preview before commit
- Import transactions to preserve payment history
- After import: use bulk magic-link invite to onboard everyone
- Magic link email prompts member to set a password on first click

---

## 12. Project structure

```
/app
  /(auth)/
    /login
    /magic-link
    /set-password
    /reset-password
  /(admin)/
    /layout.tsx          — Sidebar nav, header, permission check
    /dashboard
    /members
    /members/[id]
    /equipment
    /equipment/[id]
    /waivers
    /settings
    /settings/roles
    /settings/system
    /settings/dashboard
    /reports
    /import              — Phase 2
    /paypal              — Phase 2: unmatched transactions
    /invitations
  /(member)/
    /layout.tsx          — Member nav, permission check
    /dashboard
    /profile
    /payments
    /certifications
    /preferences
  /api/
    /auth/[...nextauth]
    /members/
    /plans/
    /keys/
    /transactions/
    /equipment/
    /waivers/
    /notifications/
    /settings/
    /roles/
    /dashboard/
    /paypal/             — Phase 2
    /import/             — Phase 2
/prisma/
  schema.prisma
  seed.ts               — Plans, permissions, default roles, system settings
/lib/
  auth.ts               — NextAuth config
  permissions.ts         — Permission check utilities
  prisma.ts             — Prisma client singleton
  resend.ts             — Resend client
  paypal.ts             — PayPal client (Phase 2)
/components/
  /ui/                  — Shared UI primitives
  /admin/               — Admin-specific components
  /member/              — Member portal components
  /email/               — React Email templates
/emails/
  welcome.tsx
  magic-link.tsx
  payment-receipt.tsx
  payment-failed.tsx
  renewal-reminder.tsx
  plan-expired.tsx
  key-deactivated.tsx
  password-reset.tsx
  admin-new-signup.tsx
  admin-payment-failed.tsx
  admin-overdue-digest.tsx
```

---

## 13. Build order

Follow this sequence. Each step builds on the previous.

1. **Scaffold**: Next.js App Router + TypeScript + Tailwind + Prisma. Configure tailwind.config with brand colors. Set up .env.example.

2. **Schema + seed**: Create full Prisma schema from Section 5. Seed: plans, permissions, default roles (Super Admin with all permissions, Admin with standard set, Member with self-service only), system settings with defaults, one super admin account.

3. **Auth**: NextAuth with email/password + magic link. Login page, set-password page, password reset. Session includes user ID, role, and permissions array.

4. **Permission middleware**: `requirePermission()` utility. Middleware for admin route group. Middleware for member route group (own-data-only).

5. **Admin layout**: Sidebar nav (Members, Equipment, Waivers, Settings, Reports placeholder). Header with logo + logout. Responsive.

6. **Admin member list**: Full implementation per spec 7.1.

7. **Admin member detail**: All cards per spec 7.2. This is the biggest single piece.

8. **Admin equipment management**: List + detail per spec 7.3.

9. **Admin waiver templates**: Per spec 7.4.

10. **Admin settings**: Role management (spec 7.6), system settings (spec 7.7).

11. **Member portal**: Layout + dashboard (7.8), profile (7.9), payment history (7.10), certifications & waivers (7.11), notification preferences (7.12).

12. **Magic link invitations**: Invite page per spec 7.5. Welcome + magic link email templates via Resend.

13. **Password reset email**: Complete the auth email flow.

14. **Phase 2 items** (separate work stream): PayPal integration, notification engine with all templates, auto-actions, data migration/import, self-registration page.

15. **Phase 3 items** (separate work stream): Dashboard with configurable widgets, reporting/export, bulk operations.

---

## 14. Critical implementation notes

- **Server components by default.** Client components only for forms, modals, toggles, interactive elements.
- **Server actions for mutations.** Simplifies the API layer. Use `"use server"` functions.
- **Prisma client singleton.** Standard pattern to avoid connection exhaustion in dev.
- **Optimistic updates** for toggles (key active/inactive, note pin/unpin).
- **Zod validation** on both client and server. Share schema definitions.
- **Error handling everywhere.** User-friendly messages. Never expose internal errors.
- **Store dates in UTC.** Display in user's local timezone via date-fns.
- **All permission checks server-side.** UI can hide elements for convenience, but the API must enforce.
- **System notes are auto-generated.** When status changes, a MemberNote with `isSystem: true` records what changed, from what, to what, and by whom.
- **Mobile-first CSS.** Members use phones. Admin works on desktop/tablet but should not break on mobile.

---

## 15. What NOT to build

These have schema tables but no UI, no API routes, no business logic:

- AccessLog (RFID integration — table exists, nothing else)
- Guest (visitor tracking — table exists, nothing else)
- Referral program / credits
- Discord integration
- Equipment reservation/booking
- Event management (classes, workshops, RSVPs)
- Storage/locker assignment
- Stripe payment processing (schema fields exist on Member and Plan, no integration)
- DocuSeal integration (schema fields exist on WaiverTemplate and MemberWaiver, no API calls or embedding — keep waiver management as manual completion tracking only)