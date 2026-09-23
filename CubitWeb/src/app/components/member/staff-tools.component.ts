import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
@Component({selector:'app-staff-tools',template:`
<div class="profile-grid staff-tools">
  <section class="panel detail-panel"><div class="heading-with-info"><h2>Staff notes</h2><app-info title="Staff notes"><p>Leave context that other staff should know when helping this member.</p><h3>Who can read them?</h3><p>Only staff administrators can see these notes. They are not shown in the member portal.</p><h3>What gets recorded?</h3><p>Each note keeps its author and date. Adding a note does not change the plan, billing, or access. If a note needs correcting, add a follow-up so the history stays clear.</p></app-info></div>
    <label class="sr-only" for="staff-note">New staff note</label><textarea id="staff-note" [(ngModel)]="note" maxlength="4000" rows="3" placeholder="Add a note for other staff…"></textarea>
    <div class="section-heading"><span></span><button class="primary" (click)="addNote()" [disabled]="busy || !note.trim()">Add note</button></div>
    <div class="note-entry" *ngFor="let n of notes"><p>{{n.text}}</p><small>{{n.author}} · {{n.createdAt | date:'medium'}}</small></div>
    <p class="empty-small" *ngIf="!notes.length">No staff notes yet.</p>
  </section>
  <section class="panel detail-panel" *ngIf="ops"><div class="heading-with-info"><h2>Access</h2><app-info title="Access"><h3>Block membership access</h3><p>Use a staff block when a member should not be eligible for entry, even if their payments are current. Enter a reason and select Save access.</p><h3>Restoring eligibility</h3><p>Uncheck the block and save with a reason. The member still needs a current plan, to meet the billing rules, and to have an enabled key.</p><h3>Individual keys</h3><p>Disable a single lost or replaced card under Access keys. Payments never clear a staff block or re-enable a key disabled by staff.</p><p>This review changes only the copied records. It does not communicate with the door system.</p></app-info></div>
    <label class="checkbox-line"><input type="checkbox" [(ngModel)]="ops.accessHold"> Block membership access</label>

    <label>Reason for change<input [(ngModel)]="opsReason" maxlength="500"></label>
    <button class="secondary" (click)="saveOps()" [disabled]="busy || !opsReason.trim()">Save access</button>
    <div class="actions"><a class="button secondary" routerLink="/audit" [queryParams]="{memberId:memberId,actor:'all',memberReturnTo:returnTo}">View account audit log</a></div>
  </section>
</div><p class="error" role="alert" *ngIf="error">{{error}}</p><p class="success-message" role="status" *ngIf="message">{{message}}</p>
`})
export class StaffToolsComponent implements OnChanges {
  private originalHold=false;
  hasUnsavedChanges(){return !!this.note.trim()||!!this.opsReason||!!(this.ops&&this.ops.accessHold!==this.originalHold);}
  discardDraft(){this.note='';this.opsReason='';if(this.ops)this.ops.accessHold=this.originalHold;}
  @Input() memberId=''; @Input() returnTo='/memberlist'; @Output() changed=new EventEmitter<void>(); @Output() ready=new EventEmitter<void>();
  notes:any[]=[]; ops:any; note=''; opsReason=''; busy=false; error=''; message='';
  constructor(private http:HttpClient){}
  ngOnChanges(){if(this.memberId && this.memberId!=='New')this.load();}
  load(){
    forkJoin({notes:this.http.get<any[]>('/api/cubit/members/'+this.memberId+'/notes'),ops:this.http.get<any>('/api/cubit/members/'+this.memberId+'/operations')})
      .subscribe({next:r=>{this.notes=r.notes;if(!this.ops||(!this.opsReason&&this.ops.accessHold===this.originalHold)){this.ops=r.ops;this.originalHold=!!r.ops.accessHold;}this.ready.emit();},error:e=>{this.error=e.error?.message||'Could not load staff notes and account controls.';this.ready.emit();}});
  }
  addNote(){if(this.busy)return;this.busy=true;this.error='';this.message='';
    this.http.post('/api/cubit/members/'+this.memberId+'/notes',{text:this.note}).subscribe({next:()=>{this.note='';this.busy=false;this.message='Note added.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not add note.';}});
  }
  saveOps(){if(this.busy)return;this.busy=true;this.error='';this.message='';
    this.http.post('/api/cubit/members/'+this.memberId+'/operations',{accessHold:this.ops.accessHold,reason:this.opsReason}).subscribe({next:()=>{this.busy=false;this.opsReason='';this.originalHold=!!this.ops.accessHold;this.message='Access settings saved.';this.load();this.changed.emit();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save access settings.';}});
  }
}
