import { AccountSecurityComponent } from './components/account-security/account-security.component';
import { OrganizationComponent } from './components/organization/organization.component';
import { LoadingComponent } from './components/shared/loading.component';
import { ContactFieldsDirective, PhonePipe } from './services/contact-fields.directive';
import { CopyFieldDirective } from './components/shared/copy-field.directive';
import { MemberStatusDirective } from './components/shared/member-status.directive';
import { AuditLogComponent } from './components/audit-log/audit-log.component';
import { StaffSettingsComponent } from './components/staff-settings/staff-settings.component';
import { BrowserModule } from '@angular/platform-browser';
import { DraftDialogComponent, DraftExitDirective } from './services/draft-guard';
import { FieldFeedbackDirective } from './services/field-feedback.directive';
import { MemberIconDirective } from './components/shared/member-icon.directive';
import { ArrowComponent } from './components/shared/arrow.component';
import { InfoComponent } from './components/shared/info.component';
import { WaiverDocumentsComponent } from './components/waivers/waiver-documents.component';
import { NgModule } from '@angular/core';
import { AppMaterialModule } from './/app-material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { RouterModule } from '@angular/router';

import { environment } from '../environments/environment';

import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DirectoryComponent } from './components/directory/directory.component';
import { StaffToolsComponent } from './components/member/staff-tools.component';
import { EditChargeComponent } from './components/member/edit-charge.component';
import { ReportsComponent } from './components/reports/reports.component';
import { AutomationComponent } from './components/automation/automation.component';
import { BackupsComponent } from './components/automation/backups.component';
import { PortalComponent } from './components/portal/portal.component';
import { WaiversComponent } from './components/waivers/waivers.component';
import { MemberWaiversComponent } from './components/member/member-waivers.component';
import { PaymentMatchingComponent } from './components/payment-matching/payment-matching.component';
import { PlanCatalogComponent } from './components/plan-catalog/plan-catalog.component';

import { AppComponent } from './app.component';
import { LoginComponent } from './components/admin/login/login.component';
import { MemberlistComponent } from './components/memberlist/memberlist.component';

import { MemberService } from './services/member.service';
import { TbCardComponent } from './components/controls/tb-card/tb-card.component';
import { MemberComponent } from './components/member/member.component';
import { AddEditMemberPlanComponent } from './components/add-edit-member-plan/add-edit-member-plan.component';
import { AlertDialogComponent } from './components/shared/alert-dialog/alert-dialog.component';
import { AddKeyComponent } from './components/add-key/add-key.component';
import { AddTransactionComponent } from './components/add-transaction/add-transaction.component';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { AuthInterceptor } from './services/AuthInterceptor';
import { UploadFileService } from './services/upload-service.service';
import { AuthService } from './services/security/auth.service';
import { PlanService } from './services/plan.service';
import { KeyService } from './services/key.service';
import { TransactionService } from './services/transaction.service';
import { AccessLogComponent } from './components/access-log/access-log.component';
import { AccessLogService } from './services/access-log.service';

@NgModule({ declarations: [
        LoadingComponent, ContactFieldsDirective, PhonePipe, CopyFieldDirective, MemberStatusDirective, DraftDialogComponent, DraftExitDirective, FieldFeedbackDirective, MemberIconDirective, ArrowComponent, InfoComponent, WaiverDocumentsComponent,
        DirectoryComponent, OrganizationComponent,
        PaymentMatchingComponent, PlanCatalogComponent, AuditLogComponent, StaffSettingsComponent,
        StaffToolsComponent, EditChargeComponent, ReportsComponent, AutomationComponent, BackupsComponent, PortalComponent, WaiversComponent, MemberWaiversComponent,
        AppComponent,
        LoginComponent,
        MemberlistComponent,
        TbCardComponent,
        MemberComponent,
        AddEditMemberPlanComponent,
        AlertDialogComponent,
        AddKeyComponent,
        AddTransactionComponent,
        AccessLogComponent,
    ],
    bootstrap: [AppComponent], imports: [AccountSecurityComponent, AppRoutingModule,
        AppMaterialModule,
        BrowserModule,
        BrowserAnimationsModule,
        AppRoutingModule,
        AppMaterialModule,
        ReactiveFormsModule,
        FormsModule], providers: [
        AuthService,
        AccessLogService,
        MemberService,
        PlanService,
        KeyService,
        UploadFileService,
        TransactionService,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AuthInterceptor,
            multi: true,
        },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
    ] })
export class AppModule {}
