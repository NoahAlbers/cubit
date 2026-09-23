import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WaiverPreviewService } from '../../services/waiver-preview.service';
@Component({selector:'app-member-waivers',template:`
<section class="panel detail-panel"><div class="section-heading"><h2>Waivers</h2><a routerLink="/waivers">Manage waivers <app-arrow name="arrow-right"></app-arrow></a></div>
<app-waiver-lock *ngIf="!gate.unlocked" (unlocked)="load()"></app-waiver-lock>
<p *ngIf="error&&gate.unlocked" class="error" role="alert">{{error}}</p><ng-container *ngIf="data&&gate.unlocked">
<div class="waiver-card" *ngFor="let w of data.current"><div><b>{{w.version.name}}</b><small>Version {{w.version.number}} · {{w.required?'Required':'Optional'}} · {{w.version.provider==='demo'?'Demo':'DocuSeal'}}</small></div><span class="badge" [class.active]="w.signature?.status==='Signed'" [class.canceled]="w.required&&w.signature?.status!=='Signed'">{{w.signature?.status==='Signed'?'Signed':'Needs signature'}}</span></div>
<p class="muted" *ngIf="!data.current.length">No current waivers.</p><details *ngIf="data.history.length"><summary>Signed history</summary><div class="note-entry" *ngFor="let s of data.history"><b>{{s.version.name}} · Version {{s.version.number}}</b><p>{{s.signerName}} · {{s.completedAt|date:'medium'}}</p><small>{{s.provider==='demo'?'Demo signature':'DocuSeal signature'}}</small><a *ngIf="s.documentUrl" [href]="s.documentUrl" target="_blank" rel="noopener noreferrer">Signed document <app-arrow name="external-link"></app-arrow></a></div></details>
</ng-container></section>`})
export class MemberWaiversComponent implements OnChanges {
  @Input() memberId=''; @Output() ready=new EventEmitter<void>(); data:any;error='';
  constructor(private http:HttpClient,public gate:WaiverPreviewService){}
  ngOnChanges(){this.data=null;this.error='';if(this.gate.unlocked)this.load();else this.ready.emit();}
  load(){this.error='';this.http.get('/api/waivers/members/'+this.memberId).subscribe({next:d=>{this.data=d;this.ready.emit();},error:e=>{this.error=e.error?.message||'Unable to load waivers.';this.ready.emit();}});}
}
