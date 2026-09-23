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
  get memberReturnUrl(){return this.router.url.startsWith('/member/')?this.navigation.returnUrl(this.router.parseUrl(this.router.url).queryParams.returnTo):null;}
  get headerBackTarget(){return this.memberReturnUrl?this.router.parseUrl(this.memberReturnUrl):null;}
  get headerBackLabel(){return this.memberReturnUrl?this.navigation.label(this.memberReturnUrl):'';}
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
