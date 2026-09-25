import { Component,Input,Output,EventEmitter,OnInit,OnDestroy,ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { OrgDatePipe } from '../../services/org-date.pipe';
@Component({selector:'app-backup-history',standalone:true,imports:[CommonModule,FormsModule,OrgDatePipe],changeDetection:ChangeDetectionStrategy.Eager,
template:`<p class="muted">Reviewing a failure clears its recent-failure warning in System Health. It does not repair a backup, change the original result, or hide ongoing storage, worker, HTTPS or recovery problems.</p>
<div class="history-controls"><label>Show operations<select [(ngModel)]="filter" (ngModelChange)="load(1)" [disabled]="busy||!!review"><option value="all">All operations</option><option value="failed">All failures</option><option value="unreviewed">Unreviewed failures</option><option value="reviewed">Reviewed failures</option></select></label><button class="secondary" (click)="load(page)" [disabled]="busy||!!review">Refresh history</button></div>
@if(error){<p class="error" role="alert">{{error}}</p>}@if(message){<p role="status">{{message}}</p>}@if(loading){<p role="status">Loading operation history…</p>}
@if(data){<div class="table-scroll"><table><thead><tr><th>Requested</th><th>Operation</th><th>Requested by</th><th>Result</th><th>Review</th></tr></thead><tbody>
@for(job of data.rows;track job.id){<tr><td>{{job.createdAt|orgDate:'medium'}}</td><td>{{job.kind==='backup'?'Backup':job.kind==='prune'?'Local retention':'Recovery test'}}</td><td>{{job.requestedBy}}</td><td><strong>{{job.status}}</strong><p>{{job.result?.message||'Waiting for worker'}}</p>@if(job.result?.snapshot){<small>Snapshot {{job.result.snapshot}}</small>}</td><td>
@if(job.reviewedAt){<span class="badge active">Reviewed</span><small>{{job.reviewedBy}} · {{job.reviewedAt|orgDate:'medium'}}</small><p>{{job.reviewNote}}</p>}
@if(canReview&&job.status==='Failed'){<button class="secondary" (click)="begin(job)" [disabled]="busy||!!review">{{job.reviewedAt?'Reopen issue':'Mark reviewed'}}</button>}</td></tr>
@if(review?.id===job.id){<tr><td colspan="5"><form (ngSubmit)="save()"><label>{{job.reviewedAt?'Why should this issue be reopened?':'Why is this failure acceptable or resolved?'}}<textarea name="reviewReason" [(ngModel)]="reason" required minlength="3" maxlength="500" rows="2"></textarea></label><div class="history-controls"><button type="submit" class="primary" [disabled]="busy||reason.trim().length<3">{{busy?'Saving…':job.reviewedAt?'Reopen issue':'Save review'}}</button><button type="button" class="secondary" (click)="cancel()" [disabled]="busy">Cancel</button></div></form></td></tr>}}
</tbody></table></div>@if(!data.total){<p>No matching operations.</p>}
@if(data.pages>1){<nav aria-label="Backup history pages"><button class="secondary" [disabled]="loading||busy||!!review||page===1" (click)="load(page-1)">Previous</button><span>Page {{page}} of {{data.pages}} · {{data.total}} operations</span><button class="secondary" [disabled]="loading||busy||!!review||page===data.pages" (click)="load(page+1)">Next</button></nav>}}`,
styles:[`.history-controls,nav{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin:12px 0}label{display:grid;gap:6px}textarea{width:100%;box-sizing:border-box}td{vertical-align:top}td p{margin:6px 0;max-width:440px;overflow-wrap:anywhere}small{display:block;overflow-wrap:anywhere}.error{color:#a71924}`]})
export class BackupHistoryComponent implements OnInit,OnDestroy {
 @Input() canReview=false;@Output() reviewed=new EventEmitter<void>();@Output() draftChange=new EventEmitter<boolean>();
 data:any;page=1;filter='all';loading=false;busy=false;error='';message='';review:any;reason='';private request?:Subscription;private saving?:Subscription;
 constructor(private http:HttpClient){}
 ngOnInit(){this.load(1);}ngOnDestroy(){this.request?.unsubscribe();this.saving?.unsubscribe();this.draftChange.emit(false);}
 load(page:number){this.request?.unsubscribe();this.loading=true;this.error='';this.request=this.http.get<any>('/api/backups/jobs',{params:{page,filter:this.filter}}).subscribe({next:d=>{this.data=d;this.page=d.page;this.loading=false;},error:e=>{this.loading=false;this.error=e.error?.message||'Could not load operation history.';}});}
 begin(job:any){if(!this.canReview||this.busy||this.review)return;this.review=job;this.reason='';this.draftChange.emit(true);}
 cancel(){if(this.busy)return;this.review=null;this.reason='';this.draftChange.emit(false);}
 save(){if(!this.canReview||!this.review||this.busy||this.reason.trim().length<3)return;this.busy=true;this.error='';const reviewed=!this.review.reviewedAt;
  this.saving=this.http.post('/api/backups/jobs/'+encodeURIComponent(this.review.id)+'/review',{reviewed,reason:this.reason.trim(),revision:this.review.reviewRevision}).subscribe({next:()=>{this.busy=false;this.cancel();this.message=reviewed?'Failure reviewed. The original result remains in history.':'Issue reopened.';this.reviewed.emit();this.load(this.page);},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save the review.';}});
 }
}
