import { formatPhone } from '../../services/contact-format';
import { DraftGuard } from '../../services/draft-guard';
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { billingRows } from '../member/billing-history';

@Component({selector:'app-portal',templateUrl:'./portal.component.html'})
export class PortalComponent implements OnInit, OnDestroy {
  @ViewChild('details') details?:NgForm;
  private originalProfile='';page=1;size=20;
  get pages(){return Math.max(1,Math.ceil(this.rows.length/this.size));}
  get visibleRows(){return this.rows.slice((this.page-1)*this.size,this.page*this.size);}
  hasUnsavedChanges(){return !!this.profile&&JSON.stringify(this.profile)!==this.originalProfile||!!(this.signing&&(this.acknowledged||this.signName!==this.data.profile.firstName+' '+this.data.profile.lastName));}
  discardDraft(){if(this.originalProfile)this.profile=JSON.parse(this.originalProfile);this.signing=null;this.details?.form.markAsPristine();}
  canSaveDraft(){return this.section==='profile'&&!!this.details?.valid&&!this.busy;}
  saveDraft(){return this.saveProfile();}
  async closeSigning(){if(this.hasUnsavedChanges()&&!await this.drafts.confirmDiscard())return;this.signing=null;}
  data:any; profile:any; rows:any[]=[]; section='overview'; order='desc'; error=''; saved=''; busy=false;
  signing:any=null; signName=''; acknowledged=false; private subscription:Subscription;
  constructor(private drafts:DraftGuard,private http:HttpClient,private route:ActivatedRoute){}
  ngOnInit(){this.section=this.route.snapshot.data.section||'overview';this.load();}
  ngOnDestroy(){this.subscription?.unsubscribe();}
  load(){this.http.get<any>('/api/portal').subscribe({next:d=>{this.data=d;this.profile={...d.profile,phone:formatPhone(d.profile.phone)??d.profile.phone,emergencyPhone:formatPhone(d.profile.emergencyPhone)??d.profile.emergencyPhone};this.originalProfile=JSON.stringify(this.profile);this.sort();},error:e=>this.error=e.error?.message||'Unable to load your membership.'});}
  sort(){this.rows=billingRows(this.data.billing,this.order);this.page=1;}
  abs(value:number){return Math.abs(value);}
  get currentPlans(){return this.data?.plans.filter(p=>p.current)||[];}
  async saveProfile():Promise<boolean>{
    this.details?.form.markAllAsTouched();if(this.busy||!this.details?.valid)return false;
    this.busy=true;this.error='';this.saved='';
    const submitted={...this.profile};
    try{await this.http.put('/api/portal/profile',submitted).toPromise();this.originalProfile=JSON.stringify(submitted);this.details.form.markAsPristine();this.saved='Your contact details have been saved.';return true;}
    catch(e){this.error=e.error?.message||'Unable to save. Please try again.';return false;}finally{this.busy=false;}
  }
  private save(url:string,value:any,message:string){this.busy=true;this.saved='';this.error='';this.http.put(url,value).subscribe({next:()=>{this.busy=false;this.saved=message;this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to save. Please try again.';}});}
  start(waiver:any){this.busy=true;this.error='';this.http.post<any>(`/api/portal/waivers/${waiver.version.id}/start`,{}).subscribe({next:signature=>{this.busy=false;this.signing={...waiver,signature};this.signName=this.data.profile.firstName+' '+this.data.profile.lastName;this.acknowledged=false;this.load();setTimeout(()=>document.getElementById('waiver-review')?.focus());},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to start signing.';}});}
  completeDemo(){this.busy=true;this.error='';this.http.post(`/api/portal/signatures/${this.signing.signature.id}/demo-complete`,{name:this.signName,acknowledged:this.acknowledged}).subscribe({next:()=>{this.busy=false;this.signing=null;this.saved='Demo signature recorded.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to record demo signature.';}});}
  sync(signature:any){this.busy=true;this.error='';this.http.post<any>(`/api/portal/signatures/${signature.id}/sync`,{}).subscribe({next:s=>{this.busy=false;if(this.signing)this.signing.signature=s;this.saved=s.status==='Signed'?'Your signed waiver is recorded.':'Signing status: '+s.status;this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to check signing status.';}});}
}
