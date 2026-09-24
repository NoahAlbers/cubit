import { Component, HostListener, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { AuthService } from './services/security/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { ListNavigationService } from './services/list-navigation.service';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface NavItem {id?:string;label:string;icon?:string;path?:string;fragment?:string;children?:NavItem[];}

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
  sidebarCollapsed=false;
  expandedGroups:Record<string,boolean>={members:true};
  compactGroup:string|null=null;
  flyoutTop=100;
  staffNavigation:NavItem[]=[
    {id:'members',label:'Members',icon:'members',children:[{label:'All members',path:'/memberlist'},{label:'Overdue',path:'/overdue'},{label:'Waivers',path:'/waivers'}]},
    {label:'Payment matching',icon:'payment-matching',path:'/payments'},
    {id:'activity',label:'Activity',icon:'access',children:[{label:'Access log',path:'/accessLog'},{label:'Audit log',path:'/audit'}]},
    {label:'Reports',icon:'reports',path:'/reports'},
    {id:'settings',label:'Settings & automation',icon:'settings',children:[{label:'Billing & processing',path:'/automation'},{label:'Plan catalog',path:'/plans'},{label:'Backups & recovery',path:'/automation',fragment:'backups'}]},
    {label:'My portal',icon:'portal',path:'/portal'},
  ];
  constructor(public auth: AuthService, public router: Router, private http: HttpClient, public navigation:ListNavigationService) {
    try {const saved=JSON.parse(localStorage.getItem('cubit.navigation')||'null');if(saved){this.sidebarCollapsed=saved.compact===true;for(const id of ['members','activity','settings'])if(typeof saved.groups?.[id]==='boolean')this.expandedGroups[id]=saved.groups[id];}}catch{}
    router.events.subscribe(e=>{if(e instanceof NavigationEnd){this.menuOpen=false;this.compactGroup=null;const active=this.staffNavigation.find(item=>item.children&&this.groupCurrent(item));if(active){this.expandedGroups[active.id]=true;this.saveNavigation();}}});
  }
  get compactNavigation(){return this.sidebarCollapsed&&window.innerWidth>800;}
  navCurrent(item:NavItem){const url=this.router.parseUrl(this.router.url),path=this.router.url.split(/[?#]/)[0];if(item.path==='/memberlist'&&path.startsWith('/member/'))return true;if(item.path!==path)return false;return item.fragment?url.fragment===item.fragment:item.path!=='/automation'||url.fragment!=='backups';}
  groupCurrent(item:NavItem){return item.children?.some(child=>this.navCurrent(child))||false;}
  groupExpanded(id:string){return this.compactNavigation?this.compactGroup===id:!!this.expandedGroups[id];}
  toggleGroup(id:string,event:Event){
    if(this.compactNavigation){this.compactGroup=this.compactGroup===id?null:id;const top=(event.currentTarget as HTMLElement).getBoundingClientRect().top;const count=this.staffNavigation.find(item=>item.id===id)?.children.length||0;this.flyoutTop=Math.max(12,Math.min(top,window.innerHeight-(count*44+62)));}
    else {this.expandedGroups[id]=!this.expandedGroups[id];this.saveNavigation();}
  }
  toggleSidebar(){this.sidebarCollapsed=!this.sidebarCollapsed;this.compactGroup=null;this.saveNavigation();}
  scrollToNavItem(item:NavItem){if(item.fragment&&this.router.url.split(/[?#]/)[0]===item.path){this.menuOpen=false;this.compactGroup=null;requestAnimationFrame(()=>document.getElementById(item.fragment)?.scrollIntoView());}}
  private saveNavigation(){try{localStorage.setItem('cubit.navigation',JSON.stringify({compact:this.sidebarCollapsed,groups:this.expandedGroups}));}catch{}}
  leaveGroup(event:FocusEvent){if(this.compactNavigation&&!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node))this.compactGroup=null;}
  @HostListener('document:pointerdown',['$event']) closeOutside(event:PointerEvent){if(!(event.target as Element).closest('.nav-group'))this.compactGroup=null;}
  @HostListener('window:resize') closeOnResize(){this.compactGroup=null;}
  @HostListener('document:keydown.escape',['$event']) closeOnEscape(event:KeyboardEvent){if(this.compactGroup){const button=document.querySelector('.nav-group-button[aria-controls="nav-'+this.compactGroup+'"]') as HTMLElement;this.compactGroup=null;button?.focus();event.preventDefault();}else if(this.menuOpen){this.menuOpen=false;(document.querySelector('.mobile-menu') as HTMLElement)?.focus();}}
  get sectionName(){const p=this.router.url.split(/[?#]/)[0];return ({'/memberlist':'Members','/overdue':'Overdue Memberships','/accessLog':'Access Log','/reports':'Reports','/automation':'Settings & Automation','/audit':'Audit Log','/staff/settings':'Notification Settings','/payments':'Payment Matching','/plans':'Plan Catalog','/waivers':'Waivers','/portal':'My Membership','/portal/profile':'My Details','/portal/billing':'Billing History','/portal/waivers':'My Waivers'})[p]||(p.startsWith('/member/')?'Member Profile':'Cubit');}
  get headerBack(){
    const path=this.router.url.split(/[?#]/)[0],q=this.router.parseUrl(this.router.url).queryParams;
    if(path.startsWith('/member/')){
      const url=this.navigation.memberReturn(q.returnTo,path.split('/')[2]);
      return {target:url.split(/[?#]/)[0],query:this.router.parseUrl(url).queryParams,label:this.navigation.label(url)};
    }
    if(path==='/audit'&&q.memberId)return {target:'/member/'+q.memberId,query:{returnTo:this.navigation.memberReturn(q.memberReturnTo,q.memberId)},label:this.navigation.memberName(q.memberId)};
    if(path==='/plans')return {target:'/automation',query:this.navigation.query('/automation'),label:'Settings & automation'};
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
