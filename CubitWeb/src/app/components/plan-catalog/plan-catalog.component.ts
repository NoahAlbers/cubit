import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DraftGuard } from '../../services/draft-guard';
import { ListNavigationService } from '../../services/list-navigation.service';
@Component({
    selector: 'app-plan-catalog', templateUrl: './plan-catalog.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class PlanCatalogComponent implements OnInit {
  data:any;error='';message='';busy=false;filter='available';draft:any;baseline='';creating=false;
  constructor(private http:HttpClient,private route:ActivatedRoute,private router:Router,private guard:DraftGuard,public navigation:ListNavigationService){}
  ngOnInit(){this.route.queryParamMap.subscribe(p=>this.filter=['all','retired'].includes(p.get('state'))?p.get('state'):'available');this.load();}
  load(){this.http.get<any>('/api/cubit/plan-catalog').subscribe({next:d=>{this.data=d;this.navigation.restoreScroll();},error:e=>this.error=e.error?.message||'Could not load plans.'});}
  get plans(){return (this.data?.plans||[]).filter(p=>this.filter==='all'||p.available===(this.filter==='available'));}
  setFilter(){this.router.navigate([],{relativeTo:this.route,queryParams:{state:this.filter}});}
  hasUnsavedChanges(){return !!this.draft&&JSON.stringify(this.draft)!==this.baseline;}
  discardDraft(){this.draft=null;this.baseline='';}
  async edit(plan?:any){if(this.hasUnsavedChanges()&&!await this.guard.confirmDiscard())return;this.error='';this.message='';this.creating=!plan;this.draft=plan?{...plan,monthlyCost:Number(plan.monthlyCost)}:{id:crypto.randomUUID(),name:'',monthlyCost:60,available:true};this.baseline=JSON.stringify(this.draft);}
  async cancel(){if(!this.hasUnsavedChanges()||await this.guard.confirmDiscard())this.discardDraft();}
  valid(){return this.draft?.name?.trim()&&Number.isFinite(this.draft.monthlyCost)&&this.draft.monthlyCost>=0&&this.draft.monthlyCost<=99999999&&Math.abs(this.draft.monthlyCost*100-Math.round(this.draft.monthlyCost*100))<0.00001;}
  save(){if(this.busy||!this.valid())return;this.busy=true;this.error='';const action=this.creating?this.http.post('/api/cubit/plan-catalog',this.draft):this.http.put('/api/cubit/plan-catalog/'+this.draft.id,this.draft);action.subscribe({next:()=>{this.busy=false;this.message=this.creating?'Plan created.':'Plan saved. Existing membership rates and posted charges are unchanged.';this.discardDraft();this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save the plan.';if(e.status===409){this.load();this.error='This plan changed elsewhere. Cancel this edit, then reopen the plan to review its latest details.';}}});}
}
