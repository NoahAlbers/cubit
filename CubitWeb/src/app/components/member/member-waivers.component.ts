import { Component, Input, Output, EventEmitter, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WaiverPreviewService } from '../../services/waiver-preview.service';
@Component({
    selector: 'app-member-waivers', template: `
<section class="panel detail-panel"><div class="section-heading"><h2>Waivers</h2><a routerLink="/waivers">Manage waivers <app-arrow name="arrow-right"></app-arrow></a></div>
@if (!gate.unlocked) {
  <app-waiver-lock (unlocked)="load()"></app-waiver-lock>
}
@if (error&&gate.unlocked) {
  <p class="error" role="alert">{{error}}</p>
  }@if (data&&gate.unlocked) {
  @for (w of data.current; track w) {
    <div class="waiver-card"><div><b>{{w.version.name}}</b><small>Version {{w.version.number}} · {{w.required?'Required':'Optional'}} · {{w.version.provider==='demo'?'Demo':w.version.provider==='paper'?'Paper upload':'DocuSeal'}}</small></div><span class="badge" [class.active]="w.complete" [class.canceled]="w.required&&!w.complete">{{w.complete?'Complete':'Needs signature'}}</span></div>
  }
  @if (!data.current.length) {
    <p class="muted">No current waivers.</p>
    }@if (data.history.length) {
    <details><summary>Signed history</summary>@for (s of data.history; track s) {
    <div class="note-entry"><b>{{s.version.name}} · Version {{s.version.number}}</b><p>{{s.signerName}} · {{s.completedAt|date:'medium'}}</p><small>{{s.provider==='demo'?'Demo signature':'DocuSeal signature'}}</small>@if (s.documentUrl) {
    <a [href]="s.documentUrl" target="_blank" rel="noopener noreferrer">Signed document <app-arrow name="external-link"></app-arrow></a>
  }</div>
}</details>
}
<app-waiver-documents [staff]="true" [memberId]="memberId" [waivers]="data.current" [documents]="data.documents" (changed)="load()"></app-waiver-documents>
}</section>`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MemberWaiversComponent implements OnChanges {
  @Input() memberId=''; @Output() ready=new EventEmitter<void>(); data:any;error='';
  constructor(private http:HttpClient,public gate:WaiverPreviewService){}
  ngOnChanges(){this.data=null;this.error='';if(this.gate.unlocked)this.load();else this.ready.emit();}
  load(){this.error='';this.http.get('/api/waivers/members/'+this.memberId).subscribe({next:d=>{this.data=d;this.ready.emit();},error:e=>{this.error=e.error?.message||'Unable to load waivers.';this.ready.emit();}});}
}
