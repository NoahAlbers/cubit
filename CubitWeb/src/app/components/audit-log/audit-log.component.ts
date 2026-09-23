import {Component,OnInit,OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {ListNavigationService} from '../../services/list-navigation.service';
@Component({selector:'app-audit-log',templateUrl:'./audit-log.component.html'})
export class AuditLogComponent implements OnInit,OnDestroy {
  data:any;error='';loading=false;q='';from='';to='';author='';kind='';actor='staff';memberId='';memberReturnTo='';sort='date';order='desc';page=1;pageSize=20;expanded='';private version=0;private sub:Subscription;
  constructor(private http:HttpClient,private route:ActivatedRoute,private router:Router,public navigation:ListNavigationService){}
  ngOnInit(){this.sub=this.route.queryParamMap.subscribe(p=>{for(const k of ['q','from','to','author','kind','memberId','memberReturnTo'])this[k]=p.get(k)||'';this.actor=p.get('actor')==='all'?'all':'staff';this.sort=['date','action','staff','member'].includes(p.get('sort'))?p.get('sort'):'date';this.order=p.get('order')==='asc'?'asc':'desc';this.page=Math.max(1,Number(p.get('page'))||1);this.pageSize=[20,50,100].includes(Number(p.get('pageSize')))?Number(p.get('pageSize')):20;this.load();});}
  ngOnDestroy(){this.sub?.unsubscribe();this.version++;}
  load(){const version=++this.version;this.loading=true;this.error='';this.expanded='';const params:any={q:this.q,from:this.from,to:this.to,author:this.author,kind:this.kind,actor:this.actor,memberId:this.memberId,sort:this.sort,order:this.order,page:String(this.page),pageSize:String(this.pageSize)};this.http.get<any>('/api/cubit/audit',{params}).subscribe({next:d=>{if(version!==this.version)return;this.data=d;this.page=d.page;this.loading=false;this.navigation.restoreScroll();},error:e=>{if(version!==this.version)return;this.loading=false;this.error=e.error?.message||'Could not load audit history.';}});}
  apply(page=1){this.router.navigate([],{relativeTo:this.route,queryParams:{q:this.q,from:this.from,to:this.to,author:this.author,kind:this.kind,actor:this.actor,memberId:this.memberId||null,memberReturnTo:this.memberReturnTo||null,sort:this.sort,order:this.order,page,pageSize:this.pageSize}});}
  sortBy(key:string){this.order=this.sort===key&&this.order==='asc'?'desc':'asc';this.sort=key;this.apply();}
  icon(key:string){return this.sort===key?(this.order==='asc'?'arrow-up':'arrow-down'):'arrow-up-down';}
  ariaSort(key:string){return this.sort===key?(this.order==='asc'?'ascending':'descending'):'none';}
  value(v:any){return v===null||v===undefined?'—':typeof v==='boolean'?(v?'Yes':'No'):typeof v==='object'?JSON.stringify(v):String(v);}
  label(field:string){return field.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());}
  get pageNumbers(){return Array.from({length:Math.min(this.data?.pages||1,this.page+4)-Math.max(1,this.page-4)+1},(_,i)=>Math.max(1,this.page-4)+i);}
}
