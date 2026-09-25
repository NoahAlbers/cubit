import { OrgDatePipe } from '../../services/org-date.pipe';
import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({selector:'app-login-history',standalone:true,imports:[OrgDatePipe,CommonModule],changeDetection:ChangeDetectionStrategy.Eager,
  template:`<section class="password-reset-section"><h3>Recent sign-ins</h3><p class="muted">Your successful sign-ins, newest first. Up to 500 sign-ins from the past 180 days are retained, starting when this feature was enabled. Location is approximate and may show a VPN or network location.</p>
  @if(error){<p role="alert" class="error">{{error}}</p><button class="secondary" (click)="load(page)">Retry</button>}
  @if(loading){<p role="status">Loading sign-ins…</p>}
  @if(data){@if(data.privateDemo){<p>Visitor sign-in details are private and are not recorded in the shared demo.</p>}
  @else if(!data.rows.length){<p>No sign-ins recorded yet.</p>}
  @for(row of data.rows;track row.id){<article><div class="history-heading"><strong>{{row.device.browser}} · {{row.device.os}}</strong><time>{{row.createdAt|orgDate:'medium'}}</time></div><p>{{row.device.device}} · {{row.method}}</p><p>IP: {{row.device.ip||'Unavailable'}}</p><p class="muted">{{row.location||'Location unavailable'}}</p></article>}
  @if(data.total>data.pageSize){<nav aria-label="Sign-in history pages"><button class="secondary" [disabled]="loading||page===1" (click)="load(page-1)">Previous</button><span>Page {{page}} of {{pages}}</span><button class="secondary" [disabled]="loading||page>=pages" (click)="load(page+1)">Next</button></nav>}}
  </section>`,styles:[`article{padding:14px 0;border-bottom:1px solid #dbe5f2}article p{margin:4px 0}.history-heading{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}time{font-size:.85rem;color:#526780}nav{display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap}.error{color:#a71924}`]})
export class LoginHistoryComponent implements OnInit {
  data:any;page=1;loading=false;error='';
  constructor(private http:HttpClient){}
  get pages(){return Math.max(1,Math.ceil((this.data?.total||0)/10));}
  ngOnInit(){this.load(1);}
  async load(page:number){if(this.loading)return;this.loading=true;this.error='';try{this.data=await firstValueFrom(this.http.get<any>('/api/account/logins',{params:{page}}));this.page=this.data.page;}catch{this.error='Could not load sign-in history.';}finally{this.loading=false;}}
}
