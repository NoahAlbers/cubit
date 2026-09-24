import {TestBed} from '@angular/core/testing';
import {provideHttpClient,withXhr} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {describe,it,expect,vi} from 'vitest';
import {AppModule} from '../../app.module';
import {OrganizationComponent} from './organization.component';
import {OrganizationService} from '../../services/organization.service';
import {AuthService} from '../../services/security/auth.service';

describe('Organization management',()=>{
  it('updates public branding and retains an unfinished settings draft when saving an account',async()=>{
    await TestBed.configureTestingModule({imports:[AppModule],providers:[provideHttpClient(withXhr()),provideHttpClientTesting(),{provide:AuthService,useValue:{isAdmin:true,isStaff:true,logout:vi.fn()}}]}).compileComponents();
    const fixture=TestBed.createComponent(OrganizationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    const settings={id:'default',name:'Community Lab',supportEmail:'help@example.test',revision:1};
    fixture.detectChanges();http.expectOne('/api/organization').flush({settings,staff:[],currentUserId:'self'});await fixture.whenStable();
    c.settings.name='Renamed Lab';const saving=c.saveSettings();const put=http.expectOne('/api/organization/settings');expect(put.request.body).toEqual({name:'Renamed Lab',supportEmail:'help@example.test',revision:1});put.flush({...settings,name:'Renamed Lab',revision:2});await saving;
    expect(TestBed.inject(OrganizationService).name).toBe('Renamed Lab');expect(c.settingsDirty).toBe(false);
    c.settings.name='Unfinished draft';await c.select();c.edit.firstName='New';c.edit.lastName='Staff';c.edit.email='new.staff@example.test';
    const adding=c.saveAccount();const post=http.expectOne('/api/organization/staff');expect(post.request.body.role).toBe('staff');post.flush({id:'new',...post.request.body,loginDisabled:false,staffVersion:0,hasPassword:false});await Promise.resolve();
    http.expectOne('/api/organization').flush({settings:{...settings,name:'Renamed Lab',revision:2},staff:[],currentUserId:'self'});await adding;
    expect(c.settings.name).toBe('Unfinished draft');expect(c.settingsDirty).toBe(true);expect(c.edit.id).toBe('new');expect(c.accountDirty).toBe(false);
    const invite=c.prepareLink();http.expectOne('/api/account/members/new/link').flush({path:'/account/activate#token=fixture',expiresAt:'2026-09-25'});await invite;expect(c.link).toContain('#token=fixture');
    http.verify();fixture.destroy();
  });
  it('routes Staff Users to the workspace and denies Administration pages',async()=>{
    await TestBed.configureTestingModule({imports:[AppModule],providers:[provideHttpClient(withXhr()),provideHttpClientTesting()]}).compileComponents();
    const auth=TestBed.inject(AuthService);auth.authToken='test.'+btoa(JSON.stringify({role:'staff',exp:Date.now()/1000+3600}))+'.test';
    expect(auth.isStaff).toBe(true);expect(auth.isAdmin).toBe(false);expect(auth.home).toBe('/memberlist');
    expect(auth.canActivate({data:{}} as any)).toBe(true);expect(String(auth.canActivate({data:{administration:true}} as any))).toBe('/memberlist');
    auth.authToken='test.'+btoa(JSON.stringify({role:'member',exp:Date.now()/1000+3600}))+'.test';expect(String(auth.canActivate({data:{}} as any))).toBe('/portal');auth.authToken='';
  });
});
