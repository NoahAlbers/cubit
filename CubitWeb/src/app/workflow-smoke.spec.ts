import {TestBed} from '@angular/core/testing';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {of, Subject} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {AppModule} from './app.module';
import {LoginComponent} from './components/admin/login/login.component';
import {DirectoryComponent} from './components/directory/directory.component';
import {MemberComponent} from './components/member/member.component';
import {PortalComponent} from './components/portal/portal.component';
import {AuthService} from './services/security/auth.service';
import {MemberService} from './services/member.service';
import {ListNavigationService} from './services/list-navigation.service';
import {MemberIconDirective} from './components/shared/member-icon.directive';

describe('Core workflow rendering and submissions', () => {
  const route = {snapshot: {data: {} as any, queryParams: {} as any, fragment: null}, params: of({id: 'New'})};
  const auth = {validToken: () => false, signingOut: false, home: '/memberlist', login: vi.fn()};
  const navigation = {memberQuery: {returnTo: '/memberlist?page=3'}, restoreScroll: vi.fn(), rememberMember: vi.fn(), memberReturn: () => '/memberlist?page=3', label: () => 'Members'};

  beforeEach(async () => {
    // Jdenticon's Node export rejects DOM updates; browser checks cover its SVGs.
    vi.spyOn(MemberIconDirective.prototype, 'ngOnChanges').mockImplementation(() => {});
    route.snapshot.data = {}; route.snapshot.queryParams = {};
    auth.login.mockClear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn()})));
    await TestBed.configureTestingModule({imports: [AppModule], providers: [
      provideHttpClient(withXhr()), provideHttpClientTesting(),
      {provide: ActivatedRoute, useValue: route}, {provide: AuthService, useValue: auth},
      {provide: ListNavigationService, useValue: navigation},
    ]}).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => {TestBed.inject(HttpTestingController).verify(); vi.unstubAllGlobals(); vi.restoreAllMocks();});

  it('renders login validation and retries an MFA challenge without duplicate submission', () => {
    const fixture = TestBed.createComponent(LoginComponent); fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/health').flush({mode: 'test'});
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(true);
    const reply = new Subject<any>(); auth.login.mockReturnValue(reply);
    component.form.patchValue({email: 'person@example.test', password: 'synthetic-password'});
    component.login(); component.login(); expect(auth.login).toHaveBeenCalledTimes(1);
    reply.error({status: 401, error: {code: 'MFA_REQUIRED'}}); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('authenticator');
    expect(component.pending).toBe(false);
    const success = new Subject<any>(); auth.login.mockReturnValue(success);
    component.form.controls.code.setValue('123456'); component.login(); success.next({});
    expect(auth.login).toHaveBeenLastCalledWith('person@example.test', 'synthetic-password', '123456', '');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/memberlist');
    fixture.destroy();
  });

  it('restores directory pagination and sorting and resets the page when search changes', async () => {
    route.snapshot.queryParams = {page: '3', pageSize: '20', sort: 'contact', order: 'desc'};
    const fixture = TestBed.createComponent(DirectoryComponent), http = TestBed.inject(HttpTestingController);
    fixture.detectChanges(); http.expectOne('/plan').flush([]);
    await new Promise(resolve => setTimeout(resolve, 230));
    const request = http.expectOne(r => r.url === '/api/cubit/members');
    expect(request.request.params.get('page')).toBe('3'); expect(request.request.params.get('sort')).toBe('contact');
    request.flush({page: 3, pageSize: 20, pages: 4, total: 61, sort: 'contact', order: 'desc', summary: {active: 1, overdue: 0, uniqueCheckins30Days: 1}, rows: [{id: 'fixture', firstName: 'Casey', lastName: 'Example', email: 'casey@example.test', status: 'Active', balance: 0, planName: 'Standard'}]});
    fixture.detectChanges(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Casey Example');
    expect(fixture.nativeElement.textContent).toContain('Page 3 of 4');
    const input = fixture.nativeElement.querySelector('input[type=search]');
    input.value = 'casey'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 230));
    const search = http.expectOne(r => r.url === '/api/cubit/members');
    expect(search.request.params.get('page')).toBe('1'); expect(search.request.params.get('q')).toBe('casey');
    search.flush({page: 1, pageSize: 20, pages: 1, total: 0, rows: [], sort: 'contact', order: 'desc', summary: {}});
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('No members match'); fixture.destroy();
  });

  it('renders a new member profile and preserves an unsaved contact draft after a failed save', async () => {
    const saves = new Subject<any>();
    vi.spyOn(TestBed.inject(MemberService), 'saveMember').mockReturnValue(saves);
    const fixture = TestBed.createComponent(MemberComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Contact details');
    component.form.patchValue({firstName: 'Casey', lastName: 'Example', email: 'casey@example.test'});
    component.form.markAsDirty();
    const pending = component.save(); await component.save();
    expect(TestBed.inject(MemberService).saveMember).toHaveBeenCalledTimes(1);
    saves.error({error: {message: 'Synthetic save failure'}}); expect(await pending).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Synthetic save failure');
    expect(component.form.controls.email.value).toBe('casey@example.test');
    expect(component.hasUnsavedChanges()).toBe(true); expect(component.form.enabled).toBe(true); fixture.destroy();
  });

  it('renders portal contact fields and acknowledges a save only when the API succeeds', async () => {
    route.snapshot.data = {section: 'profile'};
    const fixture = TestBed.createComponent(PortalComponent), http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/portal').flush({profile: {firstName: 'Casey', lastName: 'Example', email: 'casey@example.test', phone: '3215550100', emergencyContact: '', emergencyEmail: '', emergencyPhone: ''}, billing: {charges: [], payments: []}, plans: [], waivers: {current: [], history: [], documents: []}});
    fixture.detectChanges(); await fixture.whenStable();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Emergency contact');
    expect(component.profile.phone).toBe('321-555-0100');
    component.profile.emergencyContact = 'Jordan Example'; fixture.detectChanges(); await fixture.whenStable();
    const pending = component.saveProfile();
    const save = http.expectOne('/api/portal/profile'); expect(save.request.body.emergencyContact).toBe('Jordan Example');
    expect(component.saved).toBe(''); save.flush({}); expect(await pending).toBe(true);
    fixture.detectChanges(); expect(fixture.nativeElement.textContent).toContain('Your contact details have been saved.');
    expect(component.hasUnsavedChanges()).toBe(false); fixture.destroy();
  });
});
