import {TestBed} from '@angular/core/testing';
import {provideHttpClient,withXhr} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {describe,it,expect,vi} from 'vitest';
import {AppModule} from '../../app.module';
import {AuthService} from '../../services/security/auth.service';
import {StaffSettingsComponent} from './staff-settings.component';

describe('Staff settings and authenticator enrollment',()=>{
  it('keeps recovery codes visible and blocks other requests after MFA revokes the session',async()=>{
    await TestBed.configureTestingModule({imports:[AppModule],providers:[provideHttpClient(withXhr()),provideHttpClientTesting(),{provide:AuthService,useValue:{isStaff:true,isAdmin:true,accountLabel:'staff@example.test',roleLabel:'Administration',logout:vi.fn()}}]}).compileComponents();
    const fixture=TestBed.createComponent(StaffSettingsComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/cubit/staff/preferences').flush({email:'staff@example.test',preferences:{enabled:false,unknownFobs:true,refusedFobs:true,dedupeMinutes:15,revision:1}});
    http.expectOne('/api/account/notices').flush({rows:[]});
    http.expectOne('/api/account').flush({mfaEnabled:false,mfaAvailable:true,sharedDemo:false});
    await fixture.whenStable();fixture.detectChanges();
    c.preferences!.enabled=true;fixture.detectChanges();
    c.security!.password='fictional-passphrase';await c.security!.startMfa();http.expectNone('/api/account/mfa/start');
    c.cancelPreferences();fixture.detectChanges();expect(c.hasUnsavedChanges()).toBe(false);
    c.security!.code='123456';const confirming=c.security!.confirmMfa();http.expectOne('/api/account/mfa/confirm').flush({recoveryCodes:['fictional-recovery-code']});await confirming;fixture.detectChanges();
    expect(c.hasUnsavedChanges()).toBe(true);expect(c.protectingCodes).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('fictional-recovery-code');
    c.previewAlerts();c.acknowledge('notice');c.load();c.loadNotices();http.verify();
    expect(TestBed.inject(AuthService).logout).not.toHaveBeenCalled();
    c.security!.finishSetup();expect(TestBed.inject(AuthService).logout).toHaveBeenCalled();expect(c.hasUnsavedChanges()).toBe(false);
    fixture.destroy();
  });
});
