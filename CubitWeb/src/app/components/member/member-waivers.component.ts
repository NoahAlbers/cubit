import { Component, Input, Output, EventEmitter, OnChanges, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-member-waivers',
  template: `
    <section class="panel detail-panel member-waivers">
      <div class="section-heading"><h2>Waivers</h2><a class="button secondary" routerLink="/waivers">Manage waivers <app-arrow name="arrow-right"></app-arrow></a></div>
      @if (error) { <p class="error" role="alert">{{error}}</p> }
      @if (!data && !error) { <app-loading [compact]="true" label="Loading waivers…"></app-loading> }
      @if (data) {
        @for (w of data.records; track w.version.id) {
          <div class="member-waiver-record">
            <button type="button" class="waiver-summary" (click)="toggle(w.version.id)" [disabled]="uploading" [attr.aria-expanded]="expanded===w.version.id" [attr.aria-controls]="'waiver-'+w.version.id">
              <span><b>{{w.version.name}}</b><small>Version {{w.version.number}} · {{w.current ? (w.required ? 'Required' : 'Optional') : 'Previous version'}}</small></span>
              <span class="badge" [class.active]="w.status==='Complete'" [class.inactive]="w.status==='Needs review'" [class.canceled]="w.status==='Needs replacement'">{{w.status}}</span>
              <app-arrow [name]="expanded===w.version.id?'chevron-up':'chevron-down'"></app-arrow>
            </button>
            @if (expanded===w.version.id) {
              <div class="waiver-record-content" [id]="'waiver-'+w.version.id">
                @if (w.signature?.status==='Signed') { <p class="muted">{{w.signature.signerName}} · {{w.signature.completedAt|date:'medium'}}{{w.signature.provider==='demo'?' · Demo signature':''}}</p> }
                <app-waiver-documents [staff]="true" [memberId]="memberId" [allowUpload]="w.canUpload" [selectedVersionId]="w.version.id" [showHeading]="false" [waivers]="[w]" [documents]="w.documents" emptyMessage="No documents attached to this waiver." (busyChange)="uploading=$event" (changed)="load()"></app-waiver-documents>
              </div>
            }
          </div>
        } @empty { <p class="muted">No current waivers or retained waiver records.</p> }
      }
    </section>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false,
})
export class MemberWaiversComponent implements OnChanges {
  @Input() memberId='';
  @Output() ready=new EventEmitter<void>();
  data:any;error='';expanded='';uploading=false;
  constructor(private http:HttpClient){}
  ngOnChanges(){this.data=null;this.error='';this.expanded='';this.load();}
  toggle(id:string){if(!this.uploading)this.expanded=this.expanded===id?'':id;}
  load(){this.error='';this.http.get('/api/waivers/members/'+this.memberId).subscribe({next:d=>{this.data=d;this.ready.emit();},error:e=>{this.error=e.error?.message||'Unable to load waivers.';this.ready.emit();}});}
}
