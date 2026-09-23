import { WaiverDocumentsService } from '../../services/waiver-documents.service';
import { DraftGuard } from '../../services/draft-guard';
import { Component, OnInit } from '@angular/core';
import { ListNavigationService } from '../../services/list-navigation.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { WaiverPreviewService } from '../../services/waiver-preview.service';

@Component({selector:'app-waivers',templateUrl:'./waivers.component.html'})
export class WaiversComponent implements OnInit {
  tab='compliance';private original='';
  hasUnsavedChanges(){return !!this.form&&(this.confirmed||JSON.stringify(this.form)!==this.original);}
  discardDraft(){this.form=null;this.confirmed=false;}
  async cancelEdit(){if(this.hasUnsavedChanges()&&!await this.drafts.confirmDiscard())return;this.discardDraft();}
  data:any;error='';saved='';busy=false;editing:any=null;form:any=null;confirmed=false;search='';scope='active';completion='missing';showArchived=false;
  constructor(private documents:WaiverDocumentsService,public gate:WaiverPreviewService,private drafts:DraftGuard,private http:HttpClient, public navigation:ListNavigationService, private route:ActivatedRoute, private router:Router){}
  ngOnInit(){const q=this.route.snapshot.queryParams;this.search=q.search||'';this.scope=q.scope==='all'?'all':'active';this.completion=['all','complete'].includes(q.completion)?q.completion:'missing';this.showArchived=q.archived==='true';this.load();}
  remember(){this.router.navigate([],{relativeTo:this.route,queryParams:{search:this.search,scope:this.scope,completion:this.completion,archived:this.showArchived},replaceUrl:true});}
  load(){if(!this.gate.unlocked)return;this.error='';this.http.get<any>('/api/waivers').subscribe({next:d=>{this.data=d;this.navigation.restoreScroll();},error:e=>this.error=e.error?.code==='WAIVER_PREVIEW_LOCKED'?'':e.error?.message||'Unable to load waivers.'});}
  get visibleWaivers(){return this.data?.waivers.filter(w=>this.showArchived||!w.archived)||[];}
  get members(){const q=this.search.trim().toLowerCase();return this.data?.compliance.filter(m=>(this.scope==='all'||m.status==='Active')&&
    (this.completion==='all'||(this.completion==='missing'?m.missing.length>0:m.missing.length===0))&&(!q||(m.name+' '+m.email).toLowerCase().includes(q)))||[];}
  async edit(w?:any){if(this.hasUnsavedChanges()&&!await this.drafts.confirmDiscard())return;this.tab='templates';this.error='';this.saved='';this.editing=w||null;this.confirmed=false;this.form={name:w?.name||'',description:w?.version.description||'',required:w?.required??true,
    provider:w?.version.provider||'paper',sourceDocumentId:null,demoText:w?.version.demoText||'LOCAL DEMONSTRATION — NOT A LEGAL WAIVER\n\nReplace this text with a sample document for testing.',
    docusealTemplateId:null,signerRole:w?.version.signerRole||'Member',revision:w?.revision};this.original=JSON.stringify(this.form);setTimeout(()=>document.getElementById('waiver-editor')?.focus());}
  publish(){this.busy=true;this.error='';this.http.post(this.editing?`/api/waivers/${this.editing.id}/versions`:'/api/waivers',this.form).subscribe({next:()=>{this.busy=false;this.form=null;this.saved='Waiver published. Members now see the current version.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to publish waiver.';}});}
  archive(w:any){this.busy=true;this.error='';this.http.post(`/api/waivers/${w.id}/archive`,{archived:!w.archived,revision:w.revision}).subscribe({next:()=>{this.busy=false;this.saved=w.archived?'Waiver restored.':'Waiver archived. Signed records are preserved.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to update waiver.';}});}
  sync(s:any){this.busy=true;this.error='';this.http.post(`/api/waivers/signatures/${s.id}/sync`,{}).subscribe({next:()=>{this.busy=false;this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to check status.';}});}
  async uploadTemplate(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;this.busy=true;this.error='';try{if(file.type!=='application/pdf'||file.size>10*1024*1024)throw Error('Choose a PDF up to 10 MB.');const d=await this.documents.upload('/api/waivers/documents/template',file);this.form.sourceDocumentId=d.id;this.saved='Template PDF uploaded: '+d.filename;}catch(e){this.error=e.error?.message||e.message||'Unable to upload template.';}finally{this.busy=false;}}
  get pendingDocuments(){return this.data?.documents.filter(d=>d.status==='Pending review')||[];}
  missingNames(member:any){return member.missing.map(w=>w.name).join(', ');}
}
