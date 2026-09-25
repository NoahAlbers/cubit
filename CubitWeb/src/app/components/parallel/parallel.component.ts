import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, combineLatest, startWith } from 'rxjs';
import { OrgDatePipe } from '../../services/org-date.pipe';

@Component({
 selector:'app-parallel',standalone:true,imports:[CommonModule,FormsModule,RouterModule,OrgDatePipe],
 templateUrl:'./parallel.component.html',styleUrl:'./parallel.component.css',changeDetection:ChangeDetectionStrategy.Eager,
})
export class ParallelComponent implements OnInit,OnDestroy {
 status:any;data:any;profile:any;error='';message='';loading=false;busy=false;
 kind='member';query='';page=1;pageSize=20;memberId='';draft:any;
 private subscriptions=new Subscription();private search=new Subject<string>();private reload=new Subject<void>();
 constructor(private http:HttpClient,private route:ActivatedRoute,private router:Router){}
 ngOnInit(){
  this.refreshStatus();
  this.subscriptions.add(this.search.pipe(debounceTime(300),distinctUntilChanged()).subscribe(()=>this.navigate({q:this.query,page:1})));
  this.subscriptions.add(combineLatest([this.route.queryParamMap,this.reload.pipe(startWith(undefined))]).pipe(switchMap(([p])=>{
   this.kind=['member','transaction','access_log','plan'].includes(p.get('kind'))?p.get('kind'):'member';
   this.query=p.get('q')||'';this.page=Math.max(1,Number(p.get('page'))||1);this.pageSize=[20,50,100].includes(Number(p.get('pageSize')))?Number(p.get('pageSize')):20;
   this.memberId=p.get('member')||'';this.error='';this.loading=true;this.profile=null;this.data=null;this.draft=null;
   const url=this.memberId?'/api/parallel/members/'+encodeURIComponent(this.memberId):'/api/parallel/records';
   const params=new HttpParams().set('kind',this.kind).set('q',this.query).set('page',this.page).set('pageSize',this.pageSize);
   return this.http.get<any>(url,{params}).pipe(catchError(e=>{this.error=e.error?.message||'Could not load the parallel workspace.';return of(null);}));
  })).subscribe(d=>{this.loading=false;if(this.memberId)this.profile=d;else {this.data=d;if(d?.page)this.page=d.page;}if(d?.snapshot)this.status={...this.status,...d.snapshot};}));
 }
 ngOnDestroy(){this.subscriptions.unsubscribe();}
 refreshStatus(){if(this.draft){this.message='Finish or cancel the subscription link before refreshing this snapshot.';return;}this.http.get<any>('/api/parallel/status').subscribe({next:s=>{this.status=s;this.reload.next();},error:e=>this.error=e.error?.message||'Could not read synchronization status.'});}
 navigate(p:any){this.router.navigate([],{relativeTo:this.route,queryParams:p,queryParamsHandling:'merge'});}
 searchChanged(){this.search.next(this.query);}
 select(kind:string){this.navigate({kind,page:1,q:'',member:null});}
 openMember(id:string){if(id)this.navigate({member:id});}
 back(){this.navigate({member:null});}
 get pages(){return Math.max(1,Math.ceil((this.data?.total||0)/this.pageSize));}
 get pageNumbers(){return Array.from({length:Math.min(5,this.pages)},(_,i)=>Math.max(1,Math.min(this.page-2,this.pages-4))+i);}
 money(value:any){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));}
 utc(value:any){return value?String(value).replace(' ','T').replace(/Z?$/,'Z'):null;}
 linked(plan:any){return this.profile?.links?.find((l:any)=>l.membershipId===plan.id);}
 editLink(plan:any){const old=this.linked(plan);this.message='';this.draft={membershipId:plan.id,memberId:this.profile.member.id,merchantAccount:old?.merchantAccount||'',subscriptionId:old?.subscriptionId||plan.paypalSubscriptionId||'',subscriptionPlanId:old?.subscriptionPlanId||plan.paypalSubscriptionPlanId||'',reason:'',confirmed:false,revision:old?.revision||0};}
 saveLink(){if(this.busy||!this.draft)return;this.busy=true;const {membershipId,...body}=this.draft;this.http.put<any>('/api/parallel/subscription-links/'+encodeURIComponent(membershipId),body).subscribe({next:l=>{this.profile.links=this.profile.links.filter((x:any)=>x.membershipId!==membershipId).concat(l);this.draft=null;this.busy=false;this.message='Subscription link saved in Cubit. Tonic, billing and door access were not changed.';},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save subscription link.';}});}
}
