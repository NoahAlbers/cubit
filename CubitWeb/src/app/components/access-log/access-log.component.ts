import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { AccessLogService } from '../../services/access-log.service';
import { ListNavigationService } from '../../services/list-navigation.service';

@Component({
    selector: 'app-access-log', templateUrl: './access-log.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AccessLogComponent implements OnInit, OnDestroy {
  private request?:Subscription;
  private searchTimer?:ReturnType<typeof setTimeout>;
  ngOnDestroy(){this.request?.unsubscribe();clearTimeout(this.searchTimer);}
  rows:any[]=[]; loading=true; error='';
  search=''; period='30'; result='all'; sort='timestamp'; order='desc'; page=1; pageSize=20; total=0; pages=1;
  sizes=[10,20,50,100];
  constructor(private accessLogService:AccessLogService, private router:Router, private route:ActivatedRoute, public navigation:ListNavigationService){}
  ngOnInit(){
    const q=this.route.snapshot.queryParams;
    this.search=q.search||'';this.result=['granted','denied'].includes(q.result)?q.result:'all';
    this.period=['30','90','180','365','all'].includes(q.period)?q.period:'30';
    this.sort=['name','result','timestamp'].includes(q.sort)?q.sort:'timestamp';this.order=q.order==='asc'?'asc':'desc';
    this.page=Math.max(1,Math.floor(Number(q.page))||1);this.pageSize=this.sizes.includes(Number(q.pageSize))?Number(q.pageSize):20;
    this.apply(false,true);
  }
  searchChanged(){
    clearTimeout(this.searchTimer);this.request?.unsubscribe();
    this.loading=true;this.rows=[];
    this.searchTimer=setTimeout(()=>this.apply(),250);
  }
  apply(reset=true,restore=false){
    clearTimeout(this.searchTimer);this.request?.unsubscribe();
    if(reset)this.page=1;
    this.loading=true;this.error='';this.rows=[];
    const params={period:this.period,search:this.search,result:this.result,sort:this.sort,order:this.order,page:this.page,pageSize:this.pageSize};
    this.request=this.accessLogService.getAccessLog(params).subscribe({next:data=>{
      this.rows=data.rows;this.total=data.total;this.page=data.page;this.pages=data.pages;this.loading=false;
      this.router.navigate([],{relativeTo:this.route,queryParams:{...params,page:this.page},replaceUrl:true}).then(()=>{if(restore)this.navigation.restoreScroll();});
    },error:()=>{this.error='Could not load the access log. Please refresh.';this.loading=false;}});
  }
  sortBy(column:string){this.order=this.sort===column?(this.order==='asc'?'desc':'asc'):(column==='timestamp'?'desc':'asc');this.sort=column;this.apply();}
  icon(column:string){return this.sort===column?(this.order==='asc'?'sort-ascending':'sort-descending'):'sort';}
  ariaSort(column:string){return this.sort===column?(this.order==='asc'?'ascending':'descending'):'none';}
  go(page:number){if(page<1||page>this.pages||page===this.page)return;this.page=page;this.apply(false);}
  get pageNumbers(){const start=Math.max(1,this.page-4),end=Math.min(this.pages,this.page+4);return Array.from({length:end-start+1},(_,i)=>start+i);}
  get firstRow(){return this.total?(this.page-1)*this.pageSize+1:0;}
  get lastRow(){return Math.min(this.page*this.pageSize,this.total);}
}
