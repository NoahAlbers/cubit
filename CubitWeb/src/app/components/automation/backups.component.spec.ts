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
  await TestBed.configureTestingModule({declarations:[BackupsComponent],imports:[CommonModule,FormsModule],schemas:[NO_ERRORS_SCHEMA],providers:[provideHttpClient(withXhr()),provideHttpClientTesting()]}).compileComponents();
  const fixture=TestBed.createComponent(BackupsComponent),http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  const snapshot={id:'a'.repeat(64),createdAt:'2026-09-24T10:00:00Z',bytes:1048576};
  const data={hosted:true,revision:2,settings:{frequency:'manual',localKeep:3,remoteKeep:30,verifyDays:0,offsiteEnabled:false},runtime:{available:true,localReady:true,snapshots:[snapshot],inventoryCheckedAt:snapshot.createdAt},jobs:[]};
  http.expectOne('/api/backups').flush(data);fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('1.0 MB');expect(fixture.nativeElement.textContent).toContain('Saved local backups');
  const button=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:HTMLButtonElement)=>b.textContent.includes('Test this backup')) as HTMLButtonElement;
  button.click();const request=http.expectOne('/api/backups/jobs');expect(request.request.body).toEqual({kind:'verify',snapshot:snapshot.id});request.flush({});http.expectOne('/api/backups').flush(data);
  fixture.destroy();http.verify();
 });
});
