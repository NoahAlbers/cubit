import { OrganizationService } from './services/organization.service';
import { IdleSessionService } from './services/security/idle-session.service';
import { Component, HostListener, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../environments/environment';
import { AuthService } from './services/security/auth.service';
import { Router, NavigationEnd } from '@angular/router';
import { ListNavigationService } from './services/list-navigation.service';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

interface NavItem {id?:string;label:string;icon?:string;path?:string;fragment?:string;children?:NavItem[];administration?:boolean;}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styles: [
        '.mainContainer{ max-width:1000px; margin-left: auto; margin-right:auto;}',
    ],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AppComponent implements OnInit {
  isAuthenticated = false;
  userRole: string;
  identity: string;
  photoURL: string;

  dataMode = '';
  accountNotices=0;
  private lastNoticeCheck=0;
  refreshAccountNotices(){if(!this.auth.validToken()||!this.auth.isStaff){this.accountNotices=0;return;}if(Date.now()-this.lastNoticeCheck<15000)return;this.lastNoticeCheck=Date.now();this.http.get<any>('/api/account/notices/count').subscribe({next:d=>this.accountNotices=d.count,error:()=>{this.accountNotices=0;}});}
  workspaceLabel = '';
  menuOpen=false;
  sidebarCollapsed=false;
  expandedGroups:Record<string,boolean>={};
  compactGroup:string|null=null;
  hoverLabel='';
  private flyoutClose:ReturnType<typeof setTimeout>|undefined;
  flyoutTop=100;
  staffNavigation:NavItem[]=[
    {id:'members',label:'Members',icon:'members',path:'/memberlist',children:[{label:'All members',path:'/memberlist'},{label:'Overdue',path:'/overdue'},{label:'Waivers',path:'/waivers'}]},
    {label:'Payment matching',icon:'payment-matching',path:'/payments'},
    {label:'Access log',icon:'access',path:'/accessLog'},
    {label:'Audit log',icon:'audit',path:'/audit'},
    {label:'Reports',icon:'reports',path:'/reports'},
    {id:'settings',label:'Settings & automation',icon:'settings',path:'/automation',children:[{label:'Billing & processing',path:'/automation'},{label:'Plan catalog',path:'/plans'},{label:'Backups & recovery',path:'/automation',fragment:'backups'},{label:'System health',path:'/automation',fragment:'system-health'}]},
    {label:'Organization Management',icon:'organization',path:'/organization',administration:true},
  ];
  constructor(public organization:OrganizationService,public auth: AuthService, public router: Router, private http: HttpClient, public navigation:ListNavigationService, private idle:IdleSessionService) {
    try {const saved=JSON.parse(localStorage.getItem('cubit.navigation')||'null');if(saved)this.sidebarCollapsed=saved.compact===true;}catch{}
    router.events.subscribe(e=>{if(e instanceof NavigationEnd){this.refreshAccountNotices();this.menuOpen=false;this.compactGroup=null;for(const item of this.staffNavigation.filter(item=>item.children))this.expandedGroups[item.id]=this.groupCurrent(item);}});
  }
  get compactNavigation(){return this.sidebarCollapsed&&window.innerWidth>800;}
  get showWorkspace(){return this.isAuthenticated&&!['/','/app-login'].includes(this.router.url.split(/[?#]/)[0]);}
  navCurrent(item:NavItem){const url=this.router.parseUrl(this.router.url),path=this.router.url.split(/[?#]/)[0];if(item.path==='/memberlist'&&path.startsWith('/member/'))return true;if(item.path!==path)return false;return item.fragment?url.fragment===item.fragment:item.path!=='/automation'||!['backups','system-health'].includes(url.fragment||'');}
  groupCurrent(item:NavItem){return item.children?.some(child=>this.navCurrent(child))||false;}
  groupExpanded(id:string){return this.compactNavigation?this.compactGroup===id:!!this.expandedGroups[id];}
  previewNavigation(item:NavItem,event:Event){
    if(!this.compactNavigation)return;
    clearTimeout(this.flyoutClose);this.hoverLabel=item.children?'':item.label;this.compactGroup=item.id||null;
    const top=(event.currentTarget as HTMLElement).getBoundingClientRect().top;
    this.flyoutTop=Math.max(12,Math.min(top,window.innerHeight-((item.children?.length||0)*44+62)));
  }
  leaveNavigation(){clearTimeout(this.flyoutClose);this.flyoutClose=setTimeout(()=>{this.compactGroup=null;this.hoverLabel='';},150);}
  keepNavigation(){clearTimeout(this.flyoutClose);}
  previewPortal(event:Event){
    const link=(event.target as HTMLElement).closest('a');if(!link||!this.compactNavigation)return;
    this.previewNavigation({label:link.getAttribute('title')||link.textContent.trim()},event);
    this.flyoutTop=Math.max(12,Math.min(link.getBoundingClientRect().top,window.innerHeight-62));
  }
  toggleGroup(id:string,event:Event){
    if(this.compactNavigation){this.compactGroup=this.compactGroup===id?null:id;const top=(event.currentTarget as HTMLElement).getBoundingClientRect().top;const count=this.staffNavigation.find(item=>item.id===id)?.children.length||0;this.flyoutTop=Math.max(12,Math.min(top,window.innerHeight-(count*44+62)));}
    else {this.expandedGroups[id]=!this.expandedGroups[id];this.saveNavigation();}
  }
  toggleSidebar(){clearTimeout(this.flyoutClose);this.sidebarCollapsed=!this.sidebarCollapsed;this.compactGroup=null;this.hoverLabel='';this.saveNavigation();}
  openGroupHome(item:NavItem){this.expandedGroups[item.id]=true;this.menuOpen=false;this.compactGroup=null;this.saveNavigation();if(this.router.url.split('?')[0]===item.path)requestAnimationFrame(()=>window.scrollTo(0,0));}
  scrollToNavItem(item:NavItem){if(item.fragment&&this.router.url.split(/[?#]/)[0]===item.path){this.menuOpen=false;this.compactGroup=null;requestAnimationFrame(()=>document.getElementById(item.fragment)?.scrollIntoView());}}
  private saveNavigation(){try{localStorage.setItem('cubit.navigation',JSON.stringify({compact:this.sidebarCollapsed,groups:this.expandedGroups}));}catch{}}
  leaveGroup(event:FocusEvent){if(this.compactNavigation&&!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node))this.compactGroup=null;}
  @HostListener('document:pointerdown',['$event']) closeOutside(event:PointerEvent){if(!(event.target as Element).closest('.nav-group'))this.compactGroup=null;}
  @HostListener('window:resize') closeOnResize(){this.compactGroup=null;this.hoverLabel='';}
  @HostListener('document:keydown.escape',['$event']) closeOnEscape(event:KeyboardEvent){if(this.compactGroup){const button=document.querySelector('.nav-group-button[aria-controls="nav-'+this.compactGroup+'"]') as HTMLElement;button?.focus();this.compactGroup=null;this.hoverLabel='';event.preventDefault();}else if(this.hoverLabel){this.hoverLabel='';event.preventDefault();}else if(this.menuOpen){this.menuOpen=false;(document.querySelector('.mobile-menu') as HTMLElement)?.focus();}}
  get sectionName(){const p=this.router.url.split(/[?#]/)[0];if(p==='/member/New')return 'Add Member';if(p.startsWith('/account/access/'))return 'Sign-in Access';return ({'/memberlist':'Members','/overdue':'Overdue Memberships','/accessLog':'Access Log','/reports':'Reports','/automation':'Settings & Automation','/audit':'Audit Log','/organization':'Organization Management','/staff/settings':'Staff User Settings','/account/security':'Account Security','/payments':'Payment Matching','/plans':'Plan Catalog','/waivers':'Waivers','/portal':'My Membership','/portal/profile':'My Details','/portal/billing':'Billing History','/portal/waivers':'My Waivers'})[p]||(p.startsWith('/member/')?'Member Profile':'Cubit');}
  get headerBack(){
    const path=this.router.url.split(/[?#]/)[0],q=this.router.parseUrl(this.router.url).queryParams;
    if(path.startsWith('/member/')){
      const url=this.navigation.memberReturn(q.returnTo,path.split('/')[2]);
      return {target:url.split(/[?#]/)[0],query:this.router.parseUrl(url).queryParams,label:this.navigation.label(url)};
    }
    if(path==='/audit'&&q.memberId)return {target:'/member/'+q.memberId,query:{returnTo:this.navigation.memberReturn(q.memberReturnTo,q.memberId)},label:this.navigation.memberName(q.memberId)};
    if(path.startsWith('/account/access/')){const id=path.split('/')[3];return {target:'/member/'+id,query:{returnTo:this.navigation.memberReturn(q.memberReturnTo,id)},label:this.navigation.memberName(id)};}
    if(path==='/plans')return {target:'/automation',query:this.navigation.query('/automation'),label:'Settings & automation'};
    return null;
  }
  get headerBackTarget(){return this.headerBack?.target;}
  get headerBackQuery(){return this.headerBack?.query;}
  get headerBackLabel(){return this.headerBack?.label;}
  get billingSection(){return ['/automation','/plans'].includes(this.router.url.split(/[?#]/)[0]);}
  skip(event:Event){event.preventDefault();document.getElementById('main')?.focus();}
  get portalView() { return !this.auth.isStaff || this.router.url.startsWith('/portal'); }

  async logout() {
    if(this.auth.signingOut)return;
    this.auth.signingOut=true;
    const previous=this.router.url;
    try { if(await this.router.navigateByUrl('/')){
      try { await this.auth.signOutEverywhere(); this.navigation.clear(); }
      catch {
        if(this.auth.validToken()){
          await this.router.navigateByUrl(previous);
          window.alert('Sign-out could not reach the server. Your sessions have not been revoked. Please try again.');
        }
      }
    } } finally {this.auth.signingOut=false;}
  }

  ngOnInit() {
    this.auth.isAuthenticated$.pipe(switchMap(signedIn=>{
      this.organization.load();this.isAuthenticated=signedIn;this.lastNoticeCheck=0;this.refreshAccountNotices();this.workspaceLabel='';this.dataMode='';
      return this.http.get<any>('/health').pipe(catchError(()=>of({dataMode:'',workspaceLabel:this.auth.isDemo?'Synthetic demo unavailable':'Workspace unavailable'})));
    })).subscribe(d=>{this.dataMode=d.dataMode;this.workspaceLabel=d.mode==='hosted-review'?'':d.workspaceLabel||'Workspace';});
  }


}
