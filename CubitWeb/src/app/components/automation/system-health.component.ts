import { HealthTrendComponent } from './health-trend.component';
import { InfoComponent } from '../shared/info.component';
import { OrgDatePipe } from '../../services/org-date.pipe';
import {Component,OnInit,OnDestroy,Output,EventEmitter,ChangeDetectionStrategy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Subscription} from 'rxjs';
@Component({selector:'app-system-health',standalone:true,imports:[InfoComponent,HealthTrendComponent,OrgDatePipe,CommonModule],changeDetection:ChangeDetectionStrategy.Eager,
styles:[`:host{display:block}.health-header{gap:14px;flex-wrap:wrap}.health-header h2{margin:0}.health-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.health-controls label{display:flex;gap:8px;align-items:center;font-size:13px}.health-controls select{width:auto}.health-context{font-size:12px;margin:10px 0 16px}.health-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.health-check{border:1px solid var(--line);border-radius:8px;padding:12px}.health-check header{display:flex;justify-content:space-between;gap:10px;align-items:start}.health-check strong{font-size:14px}.health-check p{margin:8px 0 0;font-size:12px;line-height:1.4;overflow-wrap:anywhere}.health-status{font-size:11px;padding:3px 6px;border-radius:5px;background:#edf2f7;white-space:nowrap}.health-status.ok{background:#e9f4eb;color:#245631}.health-status.warning{background:#fff4d5;color:#785514}.health-status.critical{background:#fff0f0;color:#99232b}@media(min-width:1700px){.health-checks{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:1100px){.health-checks{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.health-checks{grid-template-columns:1fr}.health-controls{width:100%;justify-content:space-between}.health-controls label{gap:6px}}`],
template:`<section class="panel detail-panel" aria-labelledby="system-health-title">
  <div class="section-heading health-header">
    <div class="heading-with-info"><h2 id="system-health-title">System health</h2><app-info title="System health">
      <h3>Read the current status</h3><p>Green means healthy, yellow needs attention, red is critical, and gray means unavailable. The latest checks can be cached for 30 seconds. Refresh status checks again without changing settings.</p>
      <h3>Understand the charts</h3><p>Each chart uses the time span actually recorded within the selected history window. Hover or focus a chart and use the arrow keys to inspect readings. Storage and memory use a full 0–100% scale; the minimum and maximum show the observed range so small changes stay proportionate.</p>
      <p>Application and other availability checks use status bars. Blank space means no reading, not confirmed downtime. Cubit cannot record its own condition while it is stopped. Events between readings can be missed.</p>
      <h3>History and retention</h3><p>Readings are collected every five minutes. Detailed samples are kept for seven days; hourly summaries keep the lowest and highest values and worst status for up to 90 days. Larger windows may combine summaries. Older health history is automatically removed from the working database. Existing encrypted backups retain their own copies until backup retention expires.</p>
      <h3>What is being checked</h3><p>Storage and RAM describe the CRM server. The database check times a small read. The backup worker reports scheduling, recovery tests and unreviewed failures. Off-server backups, audit delivery and backup-server capacity are shown under Saved off-server backups.</p>
      <p>The HTTPS check tests the configured public address, including DNS, certificate and redirect. These checks do not contact door controllers, PayPal or the original makerspace server.</p>
      <h3>When the site is unavailable</h3><p>This page is unavailable too. Independent monitoring and alerts are still needed to detect outages. A healthy reading is not a substitute for testing recovery on a replacement server.</p>
    </app-info></div>
    <div class="health-controls"><button class="secondary" (click)="load()" [disabled]="loading">{{loading?'Checking…':'Refresh status'}}</button>@if(data&&!data.demo){<label>History<select [value]="range" (change)="range=$any($event.target).value;load()" [disabled]="loading"><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option></select></label>}</div>
  </div>
  @if(error){<p class="error" role="alert">{{error}}</p>}
  @if(data){
    <p class="muted health-context">Checked {{data.checkedAt|orgDate:'medium'}} · Hover or focus charts for details.</p>
    @if(data.demo){<p class="notice-strip">{{data.message}}</p>}
    @if(data.historyError){<p role="alert">{{data.historyError}}</p>}
    <div class="health-checks">@for(check of localChecks;track check.name){<article class="health-check"><header><strong>{{check.name}}</strong><span [class]="'health-status '+check.status">{{check.status==='ok'?'Healthy':check.status==='warning'?'Needs attention':check.status==='critical'?'Critical':'Unavailable'}}</span></header><p>{{check.detail}}</p>@if(data.history){<app-health-trend [name]="check.name" [history]="data.history"></app-health-trend>}</article>}</div>
  }
</section>`})
export class SystemHealthComponent implements OnInit,OnDestroy {
 @Output() ready=new EventEmitter<void>(); data:any;range='24h';loading=false;error='';private request?:Subscription;
 get localChecks(){return (this.data?.checks||[]).filter((c:any)=>!['Off-server recovery','Off-server audit delivery','Backup server storage'].includes(c.name));}
 constructor(private http:HttpClient){}
 ngOnInit(){this.load();}ngOnDestroy(){this.request?.unsubscribe();}
 load(){if(this.loading)return;this.loading=true;this.error='';this.request=this.http.get('/api/system-health',{params:{range:this.range}}).subscribe({next:data=>{this.data=data;this.loading=false;this.ready.emit();},error:()=>{this.loading=false;this.error='Could not reach the health service. Previous readings may be stale. Try again or ask the operator to check the server.';this.ready.emit();}});}
}
