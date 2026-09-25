import { BackupHistoryComponent } from './backup-history.component';
import { OrgDatePipe } from '../../services/org-date.pipe';
import {TestBed} from '@angular/core/testing';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {provideHttpClient,withXhr} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {describe,it,expect} from 'vitest';
import {BackupsComponent} from './backups.component';

describe('Local backup inventory',()=>{
 it('shows retained copies separately from history and targets the selected snapshot',async()=>{
  await TestBed.configureTestingModule({declarations:[BackupsComponent],imports:[BackupHistoryComponent,OrgDatePipe,CommonModule,FormsModule],schemas:[NO_ERRORS_SCHEMA],providers:[provideHttpClient(withXhr()),provideHttpClientTesting()]}).compileComponents();
  const fixture=TestBed.createComponent(BackupsComponent),http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  const snapshot={id:'a'.repeat(64),createdAt:'2026-09-24T10:00:00Z',bytes:1048576};
  const data={hosted:true,revision:2,settings:{frequency:'manual',localKeep:3,remoteKeep:30,verifyDays:0,offsiteEnabled:false},runtime:{available:true,localReady:true,snapshots:[snapshot],inventoryCheckedAt:snapshot.createdAt},jobs:[]};
  http.expectOne('/api/backups').flush(data);fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('1.0 MB');expect(fixture.nativeElement.textContent).toContain('Saved local backups');
  const inventory=fixture.nativeElement.querySelector('details[aria-label="Saved local backups"]') as HTMLDetailsElement;
  expect(inventory.open).toBe(false);inventory.querySelector('summary')!.click();expect(inventory.open).toBe(true);
  const button=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:HTMLButtonElement)=>b.textContent.includes('Test this backup')) as HTMLButtonElement;
  button.click();const request=http.expectOne('/api/backups/jobs');expect(request.request.body).toEqual({kind:'verify',snapshot:snapshot.id});request.flush({});http.expectOne('/api/backups').flush(data);
  fixture.componentInstance.data.canManageSettings=false;fixture.detectChanges();
  fixture.componentInstance.save();fixture.componentInstance.prune();fixture.componentInstance.queue('prune');
  http.expectNone('/api/backups/settings');http.expectNone('/api/backups/jobs');
  expect(fixture.nativeElement.querySelector('fieldset').disabled).toBe(true);
  expect(fixture.nativeElement.textContent).toContain('Administration manages backup schedules');
  fixture.destroy();http.verify();
 });
});
