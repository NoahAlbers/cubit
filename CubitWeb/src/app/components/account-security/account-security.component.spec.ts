import {TestBed} from '@angular/core/testing';
import {describe,it,expect,vi} from 'vitest';
import {provideHttpClient,withXhr} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {ActivatedRoute,provideRouter} from '@angular/router';
import {AccountSecurityComponent} from './account-security.component';
import {AuthService} from '../../services/security/auth.service';

describe('Account recovery and authenticator screens',()=>{
  async function render(mode:string){
    await TestBed.configureTestingModule({imports:[AccountSecurityComponent],providers:[provideRouter([]),provideHttpClient(withXhr()),provideHttpClientTesting(),
      {provide:ActivatedRoute,useValue:{snapshot:{data:{mode},paramMap:new Map(),fragment:'token=d.'+'x'.repeat(43)}}},
      {provide:AuthService,useValue:{isAdmin:true,isStaff:true,logout:vi.fn()}}]}).compileComponents();
    const fixture=TestBed.createComponent(AccountSecurityComponent);fixture.detectChanges();
    return {fixture,component:fixture.componentInstance,http:TestBed.inject(HttpTestingController)};
  }
  it('keeps password mismatches local and posts an activation token only to the redemption endpoint',async()=>{
    const {component,http}=await render('activate');component.password='strong-fixture-pass';component.confirmPassword='different';
    await component.redeem();expect(component.error).toContain('do not match');http.expectNone('/api/account/redeem');
    component.confirmPassword=component.password;const pending=component.redeem();const req=http.expectOne('/api/account/redeem');
    expect(req.request.body.token).toMatch(/^d\./);req.flush({});await pending;
    expect(component.password).toBe('');expect(component.token).toBe('');expect(component.demoWorkspace).toBe(true);http.verify();
  });
  it('retains one-time recovery codes until the staff member explicitly confirms saving them',async()=>{
    const {component,http}=await render('security');http.expectOne('/api/account').flush({mfaEnabled:false,mfaAvailable:true,sharedDemo:false});
    await Promise.resolve();component.password='strong-fixture-pass';component.code='123456';
    const enrollment=component.startMfa();http.expectOne('/api/account/mfa/start').flush({secret:'JBSWY3DPEHPK3PXP',uri:'otpauth://totp/Cubit:test%40example.test?secret=JBSWY3DPEHPK3PXP&issuer=Cubit'});await enrollment;
    expect(component.setupQr.startsWith('data:image/gif;base64,')).toBe(true);expect(component.setup.secret).toBe('JBSWY3DPEHPK3PXP');
    const pending=component.confirmMfa();http.expectOne('/api/account/mfa/confirm').flush({recoveryCodes:['fixture-code']});await pending;
    expect(component.setupQr).toBe('');expect(component.setup).toBeNull();expect(component.hasUnsavedChanges()).toBe(true);expect(TestBed.inject(AuthService).logout).not.toHaveBeenCalled();
    component.finishSetup();expect(component.hasUnsavedChanges()).toBe(false);expect(TestBed.inject(AuthService).logout).toHaveBeenCalled();http.verify();
  });
});
