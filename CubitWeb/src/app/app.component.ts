import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { AuthService } from './services/security/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { ListNavigationService } from './services/list-navigation.service';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: [
    '.mainContainer{ max-width:1000px; margin-left: auto; margin-right:auto;}',
  ],
})
export class AppComponent implements OnInit {
  isAuthenticated = false;
  userRole: string;
  identity: string;
  photoURL: string;

  dataMode = '';
  workspaceLabel = '';
  menuOpen=false;
  constructor(public auth: AuthService, public router: Router, private http: HttpClient, public navigation:ListNavigationService) {router.events.subscribe(e=>{if(e instanceof NavigationEnd)this.menuOpen=false;});}
  get sectionName(){const p=this.router.url.split(/[?#]/)[0];return ({'/memberlist':'Members','/overdue':'Overdue Memberships','/accessLog':'Access Log','/reports':'Reports','/automation':'Billing & Automation','/audit':'Audit Log','/staff/settings':'Notification Settings','/payments':'Payment Matching','/plans':'Plan Catalog','/waivers':'Waivers','/portal':'My Membership','/portal/profile':'My Details','/portal/billing':'Billing History','/portal/waivers':'My Waivers'})[p]||(p.startsWith('/member/')?'Member Profile':'Cubit');}
  get headerBack(){
    const path=this.router.url.split(/[?#]/)[0],q=this.router.parseUrl(this.router.url).queryParams;
    if(path.startsWith('/member/')){
      const url=this.navigation.memberReturn(q.returnTo,path.split('/')[2]);
      return {target:url.split(/[?#]/)[0],query:this.router.parseUrl(url).queryParams,label:this.navigation.label(url)};
    }
    if(path==='/audit'&&q.memberId)return {target:'/member/'+q.memberId,query:{returnTo:this.navigation.memberReturn(q.memberReturnTo,q.memberId)},label:this.navigation.memberName(q.memberId)};
    if(path==='/plans')return {target:'/automation',query:this.navigation.query('/automation'),label:'Billing & automation'};
    return null;
  }
  get headerBackTarget(){return this.headerBack?.target;}
  get headerBackQuery(){return this.headerBack?.query;}
  get headerBackLabel(){return this.headerBack?.label;}
  get billingSection(){return ['/automation','/plans'].includes(this.router.url.split(/[?#]/)[0]);}
  skip(event:Event){event.preventDefault();document.getElementById('main')?.focus();}
  get portalView() { return !this.auth.isAdmin || this.router.url.startsWith('/portal'); }

  async logout() {
    if(await this.router.navigateByUrl('/')){this.navigation.clear();this.auth.logout();}
  }

  ngOnInit() {
    this.auth.isAuthenticated$.pipe(switchMap(signedIn=>{
      this.isAuthenticated=signedIn;this.workspaceLabel='';this.dataMode='';
      return this.http.get<any>('/health').pipe(catchError(()=>of({dataMode:'',workspaceLabel:this.auth.isDemo?'Synthetic demo unavailable':'Workspace unavailable'})));
    })).subscribe(d=>{this.dataMode=d.dataMode;this.workspaceLabel=d.mode==='hosted-review'?'':d.workspaceLabel||'Workspace';});
  }


}
