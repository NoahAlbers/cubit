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
  get sectionName(){const p=this.router.url.split(/[?#]/)[0];return ({'/memberlist':'Members','/overdue':'Overdue memberships','/accessLog':'Access log','/reports':'Reports','/automation':'Billing & automation','/payments':'Payment matching','/plans':'Plans','/waivers':'Waivers','/portal':'My membership','/portal/profile':'My details','/portal/billing':'Billing history','/portal/waivers':'My waivers'})[p]||(p.startsWith('/member/')?'Member profile':'Cubit');}
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
