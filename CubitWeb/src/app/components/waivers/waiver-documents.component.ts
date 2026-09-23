import {Component,Input,Output,EventEmitter} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {WaiverDocumentsService} from '../../services/waiver-documents.service';
@Component({selector:'app-waiver-documents',template:`
<div class="waiver-files">
  <p class="error" role="alert" *ngIf="error">{{error}}</p><p class="success-message" role="status" *ngIf="saved">{{saved}}</p>
  <div class="waiver-upload" *ngIf="allowUpload && waivers.length">
    <h3>Attach a signed waiver</h3><p class="muted">Upload a PDF or clear photos of every page. Files are kept on this account; staff reviews them before they count as complete.</p>
    <label>Waiver<select [(ngModel)]="versionId" [disabled]="busy"><option value="">Choose a waiver</option><option *ngFor="let w of waivers" [value]="w.version.id">{{w.version.name}} · Version {{w.version.number}}</option></select></label>
    <div class="actions"><label class="button secondary file-picker">Choose files<input type="file" accept="application/pdf,image/jpeg,image/png" multiple (change)="selectFiles($event)" [disabled]="busy"></label><label class="button secondary file-picker">Take photo<input type="file" accept="image/jpeg,image/png" capture="environment" (change)="selectFiles($event)" [disabled]="busy"></label></div>
    <small>PDF, JPG or PNG · Up to 10 MB per file · Up to 5 files at once</small><ul *ngIf="files.length"><li *ngFor="let f of files">{{f.name}}</li></ul>
    <button class="primary" *ngIf="files.length" [disabled]="busy||!versionId" (click)="upload()">{{busy?'Uploading…':'Upload for review'}}</button>
  </div>
  <h3>{{allowUpload?'Documents on file':'Documents'}}</h3>
  <article class="waiver-file" *ngFor="let d of documents">
    <div><b>{{d.filename}}</b><small *ngIf="d.memberName">{{d.memberName}}</small><small>{{d.versionName}} · {{d.source}} · {{d.createdAt|date:'MMM d, y'}}</small><span class="badge" [class.active]="d.status==='Accepted'||d.status==='Stored'" [class.canceled]="d.status==='Rejected'">{{d.status}}</span><p *ngIf="d.reviewNote">{{d.reviewNote}}</p></div>
    <div class="actions"><button class="secondary" [disabled]="busy" (click)="download(d)">Download <app-arrow name="download"></app-arrow></button><button class="secondary" *ngIf="staff&&['staff upload','member upload'].includes(d.source)" [disabled]="busy" (click)="reviewing=d;reason=''">Review</button></div>
    <div class="waiver-review" *ngIf="reviewing?.id===d.id"><p>Download and check the full document, member name, signature, date and all pages before accepting.</p><label>Review note<textarea [(ngModel)]="reason" maxlength="2000" rows="2" placeholder="Record what you checked or what needs correcting"></textarea></label><div class="actions"><button class="primary" [disabled]="busy||!reason.trim()" (click)="review('Accepted')">Accept waiver</button><button class="secondary" [disabled]="busy||!reason.trim()" (click)="review('Rejected')">Needs replacement</button><button class="quiet" [disabled]="busy" (click)="reviewing=null">Cancel</button></div></div>
  </article><p class="muted" *ngIf="!documents.length">No documents on file.</p>
</div>`})
export class WaiverDocumentsComponent {
  @Input() staff=false;@Input() allowUpload=true;@Input() memberId='';@Input() waivers:any[]=[];@Input() documents:any[]=[];@Output() changed=new EventEmitter<void>();
  files:File[]=[];versionId='';error='';saved='';busy=false;reviewing:any=null;reason='';
  constructor(private service:WaiverDocumentsService,private http:HttpClient){}
  selectFiles(event:Event){const input=event.target as HTMLInputElement;this.error='';this.saved='';const files=Array.from(input.files||[]);input.value='';if(files.length>5||files.some(f=>f.size>10*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(f.type))){this.error='Choose up to 5 PDF, JPG or PNG files, each up to 10 MB.';return;}this.files=files;}
  async upload(){this.busy=true;this.error='';this.saved='';try{while(this.files.length){const f=this.files[0];await this.service.upload(this.staff?'/api/waivers/members/'+this.memberId+'/versions/'+this.versionId+'/documents':'/api/portal/waivers/'+this.versionId+'/documents',f);this.files.shift();this.changed.emit();}this.saved='Documents saved. Awaiting staff review.';}catch(e){this.error=e.error?.message||'Upload failed. Completed uploads are saved; retry the remaining files.';}finally{this.busy=false;}}
  async download(d:any){this.error='';try{await this.service.download(d,this.staff);}catch{this.error='Unable to download this document. Please try again.';}}
  async review(status:string){this.busy=true;this.error='';try{await this.http.post('/api/waivers/documents/'+this.reviewing.id+'/review',{status,reason:this.reason,revision:this.reviewing.revision}).toPromise();this.reviewing=null;this.saved='Review saved. The original file remains on record.';this.changed.emit();}catch(e){this.error=e.error?.message||'Unable to save the review.';}finally{this.busy=false;}}
}
