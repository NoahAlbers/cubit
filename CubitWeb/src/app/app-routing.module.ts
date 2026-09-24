import { AuditLogComponent } from './components/audit-log/audit-log.component';
import { AccountSecurityComponent } from './components/account-security/account-security.component';
import { StaffSettingsComponent } from './components/staff-settings/staff-settings.component';
import { NgModule } from '@angular/core';
import { DraftGuard } from './services/draft-guard';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/admin/login/login.component';
import { MemberlistComponent } from './components/memberlist/memberlist.component';
import { MemberComponent } from './components/member/member.component';
import { AccessLogComponent } from './components/access-log/access-log.component';
import { DirectoryComponent } from './components/directory/directory.component';
import { ReportsComponent } from './components/reports/reports.component';
import { AutomationComponent } from './components/automation/automation.component';
import { AuthService } from './services/security/auth.service';
import { PortalComponent } from './components/portal/portal.component';
import { WaiversComponent } from './components/waivers/waivers.component';
import { PaymentMatchingComponent } from './components/payment-matching/payment-matching.component';
import { PlanCatalogComponent } from './components/plan-catalog/plan-catalog.component';

const routes: Routes = [
  {path:'account/activate',component:AccountSecurityComponent,data:{mode:'activate'}},
  {path:'account/security',component:AccountSecurityComponent,canActivate:[AuthService],canDeactivate:[DraftGuard],data:{portal:true}},
  {path:'account/access/:id',component:AccountSecurityComponent,canActivate:[AuthService]},
  { path: '', component: LoginComponent },
  { path: 'home', redirectTo: 'memberlist', pathMatch: 'full' },
  { path: 'memberlist', component: DirectoryComponent, canActivate: [AuthService] },
  { path: 'overdue', component: DirectoryComponent, canActivate: [AuthService], data: { overdue: true } },
  { path: 'reports', component: ReportsComponent, canActivate: [AuthService] },
  { path: 'automation', component: AutomationComponent, canActivate: [AuthService] },
  { path: 'payments', component: PaymentMatchingComponent, canActivate: [AuthService], canDeactivate:[DraftGuard] },
  { path: 'audit', component: AuditLogComponent, canActivate: [AuthService] },
  { path: 'staff/settings', component: StaffSettingsComponent, canActivate: [AuthService], canDeactivate:[DraftGuard] },
  { path: 'plans', component: PlanCatalogComponent, canActivate: [AuthService], canDeactivate:[DraftGuard] },
  { path: 'waivers', component: WaiversComponent, canActivate: [AuthService], canDeactivate:[DraftGuard] },
  { path: 'portal', component: PortalComponent, canActivate: [AuthService], canDeactivate:[DraftGuard], data: { portal: true,section:'overview' } },
  ...['billing','waivers','profile'].map(section=>({path:'portal/'+section,component:PortalComponent,canActivate:[AuthService],canDeactivate:[DraftGuard],data:{portal:true,section}})),
  { path: 'member/:id', component: MemberComponent, canActivate: [AuthService], canDeactivate:[DraftGuard] },
  { path: 'app-login', component: LoginComponent },
  { path: 'accessLog', component: AccessLogComponent, canActivate: [AuthService] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
