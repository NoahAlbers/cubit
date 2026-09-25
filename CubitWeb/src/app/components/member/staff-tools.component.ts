import { Component, Input, Output, EventEmitter, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
@Component({
    selector: 'app-staff-tools', template: `
<div class="profile-grid staff-tools">
  <section class="panel detail-panel"><div class="heading-with-info"><h2>Staff notes</h2><app-info title="Staff notes"><p>Leave context that other staff should know when helping this member.</p><h3>Who can read them?</h3><p>Only staff can see these notes. They are not shown in the member portal.</p><h3>What gets recorded?</h3><p>Each note keeps its author and date. Adding a note does not change the plan, billing, or access. If a note needs correcting, add a follow-up so the history stays clear.</p></app-info></div>
  <label class="sr-only" for="staff-note">New staff note</label><textarea id="staff-note" [(ngModel)]="note" maxlength="4000" rows="3" placeholder="Add a note for other staff…"></textarea>
  <div class="section-heading"><span></span><button class="primary" (click)="addNote()" [disabled]="busy || !note.trim()">Add note</button></div>
  @for (n of notes; track n.id) {
    <article class="note-entry staff-note-entry"><p [id]="'note-'+n.id" [class.note-collapsed]="!expandedNotes.has(n.id)">{{n.text}}</p><div class="note-footer"><small>{{n.author}} · {{n.createdAt |orgDate:'medium'}}</small><button class="secondary" (click)="toggleNote(n.id)" [attr.aria-expanded]="expandedNotes.has(n.id)" [attr.aria-controls]="'note-'+n.id">{{expandedNotes.has(n.id)?'Collapse note':'Expand note'}}</button></div></article>
  }
  @if(notePages>1){<nav class="notes-pagination" aria-label="Staff notes pages"><button class="secondary" (click)="changeNotePage(notePage-1)" [disabled]="notesLoading||notePage===1">Previous</button><span>Page {{notePage}} of {{notePages}} · {{noteTotal}} notes</span><button class="secondary" (click)="changeNotePage(notePage+1)" [disabled]="notesLoading||notePage===notePages">Next</button></nav>}
  @if (!notes.length&&!notesLoading) {
    <p class="empty-small">No staff notes yet.</p>
  }
</section>
@if (ops) {
  <section class="panel detail-panel"><div class="heading-with-info"><h2>Access</h2><app-info title="Access"><h3>Block membership access</h3><p>Use a staff block when a member should not be eligible for entry, even if their payments are current. Enter a reason and select Save access.</p><h3>Restoring eligibility</h3><p>Uncheck the block and save with a reason. The member still needs a current plan, to meet the billing rules, and to have an enabled key.</p><h3>Membership and door access</h3><p>Entry requires both an Active membership and an enabled key. Inactive or canceled memberships must be refused even if their card is still marked Enabled. Members within an approved grace period remain Active.</p><h3>Individual keys</h3><p>Disable a single lost or replaced card under Access keys. Payments never clear a staff block or re-enable a key disabled by staff.</p><p>This review changes only the copied records. It does not communicate with the door system. Confirm urgent revocations in the current door system. Before launch, every controller must acknowledge removed access and stop using expired cached permissions.</p></app-info></div>
  <label class="checkbox-line"><input type="checkbox" [(ngModel)]="ops.accessHold"> Block membership access</label>
  <label>Reason for change<input [(ngModel)]="opsReason" maxlength="500"></label>
  <button class="secondary" (click)="saveOps()" [disabled]="busy || !opsReason.trim()">Save access</button>
  <div class="actions"><a class="button secondary" routerLink="/audit" [queryParams]="{memberId:memberId,actor:'all',memberReturnTo:returnTo}">View account audit log</a></div>
</section>
}
</div>@if (error) {
<p class="error" role="alert">{{error}}</p>
}@if (message) {
<p class="success-message" role="status">{{message}}</p>
}
`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class StaffToolsComponent implements OnChanges {
  private originalHold=false;
  hasUnsavedChanges(){return !!this.note.trim()||!!this.opsReason||!!(this.ops&&this.ops.accessHold!==this.originalHold);}
  discardDraft(){this.note='';this.opsReason='';if(this.ops)this.ops.accessHold=this.originalHold;}
  @Input() memberId=''; @Input() returnTo='/memberlist'; @Output() changed=new EventEmitter<void>(); @Output() ready=new EventEmitter<void>();
  notePage=1;notePages=1;noteTotal=0;notesLoading=false;expandedNotes=new Set<string>();private loadedMember='';
  toggleNote(id:string){if(this.expandedNotes.has(id))this.expandedNotes.delete(id);else this.expandedNotes.add(id);}
  changeNotePage(page:number){if(this.notesLoading||page<1||page>this.notePages)return;this.load(page);}
  notes:any[]=[]; ops:any; note=''; opsReason=''; busy=false; error=''; message='';
  constructor(private http:HttpClient){}
  ngOnChanges(){if(this.memberId!==this.loadedMember){this.notePage=1;this.notes=[];this.ops=null;this.expandedNotes.clear();this.loadedMember=this.memberId;}if(this.memberId && this.memberId!=='New')this.load();}
  load(page=this.notePage){
    this.notesLoading=true;this.error='';const memberId=this.memberId;
    forkJoin({notes:this.http.get<any>('/api/cubit/members/'+memberId+'/notes?page='+page),ops:this.http.get<any>('/api/cubit/members/'+this.memberId+'/operations')})
      .subscribe({next:r=>{if(memberId!==this.memberId)return;this.notesLoading=false;this.notes=r.notes.rows;this.notePage=r.notes.page;this.notePages=r.notes.pages;this.noteTotal=r.notes.total;this.expandedNotes.clear();if(!this.ops||(!this.opsReason&&this.ops.accessHold===this.originalHold)){this.ops=r.ops;this.originalHold=!!r.ops.accessHold;}this.ready.emit();},error:e=>{if(memberId!==this.memberId)return;this.notesLoading=false;this.error=e.error?.message||'Could not load staff notes and account controls.';this.ready.emit();}});
  }
  addNote(){if(this.busy)return;this.busy=true;this.error='';this.message='';
    this.http.post('/api/cubit/members/'+this.memberId+'/notes',{text:this.note}).subscribe({next:()=>{this.note='';this.busy=false;this.message='Note added.';this.notePage=1;this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not add note.';}});
  }
  saveOps(){if(this.busy)return;this.busy=true;this.error='';this.message='';
    this.http.post('/api/cubit/members/'+this.memberId+'/operations',{accessHold:this.ops.accessHold,reason:this.opsReason}).subscribe({next:()=>{this.busy=false;this.opsReason='';this.originalHold=!!this.ops.accessHold;this.message='Access settings saved.';this.load();this.changed.emit();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save access settings.';}});
  }
}
