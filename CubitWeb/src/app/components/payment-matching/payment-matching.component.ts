import { organizationDay } from '../../services/org-time';
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ListNavigationService } from '../../services/list-navigation.service';
import { DraftGuard } from '../../services/draft-guard';
@Component({
    selector: 'app-payment-matching', templateUrl: './payment-matching.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PaymentMatchingComponent implements OnInit {
  data:any;detail:any;error='';message='';busy=false;loading=false;state='pending';q='';page=1;selectedId='';selectedMember:any;search='';results:any[]=[];searched=false;
  create=false;newMember:any={firstName:'',lastName:'',email:'',confirmCreate:false};simulation:any;showTest=false;private loadVersion=0;private searchVersion=0;
  constructor(private http:HttpClient,private route:ActivatedRoute,private router:Router,public navigation:ListNavigationService,private guard:DraftGuard){}
  ngOnInit(){this.resetTest();this.route.queryParamMap.subscribe(p=>{this.state=p.get('state')==='processed'?'processed':'pending';this.q=p.get('q')||'';this.page=Math.max(1,Number(p.get('page'))||1);this.selectedId=p.get('event')||'';this.load();});}
  resetTest(){const d=new Date();this.simulation={id:'event-'+crypto.randomUUID(),resourceId:'resource-'+crypto.randomUUID(),kind:'payment',amount:60,eventDate:organizationDay(d),payerEmail:'',payerName:'',subscriptionId:'',parentResourceId:''};}
  hasUnsavedChanges(){return this.create&&!!(this.newMember.firstName||this.newMember.lastName||this.newMember.confirmCreate);}
  discardDraft(){this.create=false;this.newMember={firstName:'',lastName:'',email:'',confirmCreate:false};}
  async navigate(page=1,event=''){if(this.hasUnsavedChanges()&&!await this.guard.confirmDiscard())return;this.discardDraft();this.router.navigate([],{relativeTo:this.route,queryParams:{state:this.state,q:this.q,page,event:event||null}});}
  load(){const version=++this.loadVersion;this.loading=true;this.detail=null;this.selectedMember=null;this.results=[];this.search='';this.searched=false;this.searchVersion++;
    this.http.get<any>('/api/cubit/payment-matching',{params:{state:this.state,q:this.q,page:String(this.page)}}).subscribe({next:d=>{if(version!==this.loadVersion)return;this.data=d;this.page=d.page;this.loading=false;this.navigation.restoreScroll();},error:e=>{if(version!==this.loadVersion)return;this.loading=false;this.error=e.error?.message||'Could not load payment matching.';}});
    if(this.selectedId)this.http.get<any>('/api/cubit/payment-matching/'+encodeURIComponent(this.selectedId)).subscribe({next:d=>{if(version!==this.loadVersion)return;this.detail=d;this.newMember.email=d.event.payerEmail||'';},error:e=>{if(version===this.loadVersion)this.error=e.error?.message||'Could not open this event.';}});
  }
  choose(member:any){this.selectedMember=member;this.create=false;}
  searchMembers(){if(this.search.trim().length<2)return;const version=++this.searchVersion;this.http.get<any[]>('/api/cubit/matching-members',{params:{q:this.search}}).subscribe({next:d=>{if(version!==this.searchVersion)return;this.results=d;this.searched=true;},error:()=>this.error='Could not search members.'});}
  beginCreate(){this.selectedMember=null;this.create=true;}
  post(path:string,body:any,done:(r:any)=>void){if(this.busy)return;this.busy=true;this.error='';this.message='';this.http.post<any>('/api/cubit/'+path,body).subscribe({next:r=>{this.busy=false;done(r);},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save this action.';}});}
  process(){const e=this.detail.event;this.post('automation/events/'+encodeURIComponent(e.id)+'/process',this.create?{createMember:this.newMember}:{memberId:this.selectedMember?.id},r=>{this.discardDraft();this.message=r.status==='Processed'?'Payment event recorded. It will not be recorded a second time.':r.detail;this.load();});}
  simulate(){this.post('automation/events/simulate',this.simulation,r=>{this.showTest=false;this.resetTest();this.message='Offline event added. No member or payment has been created.';this.state='pending';this.navigate(1,r.id);});}
}
