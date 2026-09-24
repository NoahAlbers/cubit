import {TestBed} from '@angular/core/testing';
import {provideHttpClient,withXhr} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {describe,it,expect} from 'vitest';
import {AppModule} from '../../app.module';
import {StaffToolsComponent} from './staff-tools.component';
describe('Paged staff notes',()=>{
 it('bounds the visible list, expands individual notes and keeps drafts while paging',async()=>{
  await TestBed.configureTestingModule({imports:[AppModule],providers:[provideHttpClient(withXhr()),provideHttpClientTesting()]}).compileComponents();
  const f=TestBed.createComponent(StaffToolsComponent),c=f.componentInstance,http=TestBed.inject(HttpTestingController);
  f.componentRef.setInput('memberId','fixture');f.detectChanges();
  const rows=Array.from({length:5},(_,i)=>({id:String(i),text:'Long note '.repeat(60),author:'staff@example.test',createdAt:'2026-09-24'}));
  http.expectOne('/api/cubit/members/fixture/notes?page=1').flush({rows,page:1,pages:2,total:6});http.expectOne('/api/cubit/members/fixture/operations').flush({accessHold:false});await f.whenStable();f.detectChanges();
  expect(f.nativeElement.querySelectorAll('.staff-note-entry').length).toBe(5);expect(f.nativeElement.querySelectorAll('.note-collapsed').length).toBe(5);expect(f.nativeElement.querySelector('.notes-pagination')).not.toBeNull();
  c.toggleNote('0');f.detectChanges();expect(f.nativeElement.querySelectorAll('.note-collapsed').length).toBe(4);
  c.note='Unfinished note';c.changeNotePage(2);http.expectOne('/api/cubit/members/fixture/notes?page=2').flush({rows:[rows[0]],page:2,pages:2,total:6});http.expectOne('/api/cubit/members/fixture/operations').flush({accessHold:false});await f.whenStable();f.detectChanges();expect(c.note).toBe('Unfinished note');expect(c.expandedNotes.size).toBe(0);expect(f.nativeElement.querySelectorAll('.staff-note-entry').length).toBe(1);
  c.load();http.expectOne('/api/cubit/members/fixture/notes?page=2').flush({rows:[rows[0]],page:1,pages:1,total:1});http.expectOne('/api/cubit/members/fixture/operations').flush({accessHold:false});await f.whenStable();f.detectChanges();expect(f.nativeElement.querySelector('.notes-pagination')).toBeNull();
  http.verify();f.destroy();
 });
});
