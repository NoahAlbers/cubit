import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppModule } from './app.module';
import { provideHttpClient, withXhr, withInterceptorsFromDi, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { AddTransactionComponent } from './components/add-transaction/add-transaction.component';
import { ArrowComponent } from './components/shared/arrow.component';
import { DraftGuard } from './services/draft-guard';
import { TransactionService } from './services/transaction.service';
import { AuthInterceptor } from './services/AuthInterceptor';
import { AuthService } from './services/security/auth.service';
import { provideRouter, Router } from '@angular/router';

describe('Angular 22 billing form compatibility', () => {
  let close: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;
  let confirmDiscard: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    close = vi.fn(); save = vi.fn().mockResolvedValue({}); confirmDiscard = vi.fn().mockResolvedValue(false);
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting(),
        {provide: MAT_DIALOG_DATA, useValue: {id:'New', memberId:'synthetic-member', memberName:'Test Member'}},
        {provide: MatDialogRef, useValue: {close, keydownEvents: () => new Subject()}},
        {provide: DraftGuard, useValue: {confirmDiscard}},
        {provide: TransactionService, useValue: {saveTransaction: save}}]
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  function render() {
    const fixture = TestBed.createComponent(AddTransactionComponent);
    fixture.detectChanges();
    return fixture;
  }
  it('updates block templates and validators when switching between payment, refund, and charge', () => {
    const fixture=render(), component=fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(true);
    component.transactionForm.controls.amount.setValue(25);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(false);
    const select=fixture.nativeElement.querySelector('select[formcontrolname=kind]');
    select.value='refund'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Refund reason (required)');
    expect(component.transactionForm.valid).toBe(false);
    component.transactionForm.controls.description.setValue('Already returned to member');
    expect(component.transactionForm.valid).toBe(true);
    select.value='charge'; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Description (required)');
    expect(fixture.nativeElement.querySelector('select[formcontrolname=method]')).toBeNull();
  });
  it('posts a charge once and closes the dialog only after the request succeeds', async () => {
    const fixture=render(), component=fixture.componentInstance;
    component.transactionForm.patchValue({kind:'charge', amount:12.5, description:'Test charge'});
    const pending=component.Save();
    await component.Save();
    const request=TestBed.inject(HttpTestingController).expectOne('/api/cubit/members/synthetic-member/charges');
    expect(request.request.body.amount).toBe(12.5);
    expect(request.request.body.requestKey).toBe(component.requestKey);
    expect(close).not.toHaveBeenCalled();
    request.flush({}); await pending;
    expect(close).toHaveBeenCalledWith('Saved');
    expect(save).not.toHaveBeenCalled();
  });
  it('records refunds with a negative amount and preserves unsaved drafts on cancellation', async () => {
    const fixture=render(), component=fixture.componentInstance;
    component.transactionForm.patchValue({kind:'refund',amount:15,description:'Previously refunded'});
    component.transactionForm.markAsDirty();
    await component.onCancel(); expect(close).not.toHaveBeenCalled();
    await component.Save();
    expect(save.mock.calls[0][0].amount).toBe(-15);
    expect(close).toHaveBeenCalledWith('Saved');
  });
});

describe('Angular 22 shared rendering and authentication', () => {
  it('revokes the session before clearing browser credentials, and retains them if revocation fails', async () => {
    TestBed.configureTestingModule({providers:[AuthService,provideHttpClient(withXhr()),provideHttpClientTesting(),
      {provide:Router,useValue:{navigateByUrl:vi.fn()}}]});
    const auth=TestBed.inject(AuthService), http=TestBed.inject(HttpTestingController);
    auth.authToken='test-session';sessionStorage.setItem('cubit-token','test-session');
    const failed=auth.signOutEverywhere();const rejection=expect(failed).rejects.toBeDefined();
    http.expectOne('/logout').flush({}, {status:503,statusText:'Unavailable'});await rejection;
    expect(auth.authToken).toBe('test-session');
    const pending=auth.signOutEverywhere();
    const request=http.expectOne('/logout');expect(request.request.method).toBe('POST');
    expect(sessionStorage.getItem('cubit-token')).toBe('test-session');
    request.flush(null,{status:204,statusText:'No Content'});await pending;
    expect(auth.authToken).toBe('');expect(sessionStorage.getItem('cubit-token')).toBeNull();http.verify();
  });
  it('keeps SVG sprite links intact through template compilation', async () => {
    await TestBed.configureTestingModule({imports:[AppModule]}).compileComponents();
    const fixture=TestBed.createComponent(ArrowComponent);
    fixture.componentRef.setInput('name','arrow-left'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('use').getAttribute('href')).toBe('/assets/icons/cubit-arrows.sprite.svg#cubit-arrow-left');
  });
  it('keeps the class-based auth interceptor after the HTTP provider migration', () => {
    TestBed.configureTestingModule({providers:[provideRouter([]), provideHttpClient(withXhr(),withInterceptorsFromDi()),provideHttpClientTesting(),
      {provide:AuthService,useValue:{authToken:'synthetic-test-token',logout:vi.fn()}},
      {provide:HTTP_INTERCEPTORS,useClass:AuthInterceptor,multi:true}]});
    TestBed.inject(HttpClient).get('/api/cubit/directory').subscribe();
    const http=TestBed.inject(HttpTestingController), request=http.expectOne('/api/cubit/directory');
    expect(request.request.headers.get('Authorization')).toBe('Bearer synthetic-test-token');
    request.flush({});http.verify();
  });
});
