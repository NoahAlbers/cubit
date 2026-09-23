import { Injectable, NgZone } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, Scroll, UrlTree } from '@angular/router';
import { take } from 'rxjs/operators';

const lists = ['/memberlist','/overdue','/accessLog','/reports','/waivers','/automation','/payments','/plans','/audit','/staff/settings'];
@Injectable({providedIn:'root'})
export class ListNavigationService {
  private last = new Map<string,string>();
  private memberNames = new Map<string,string>();
  rememberMember(id:string,name:string){if(id&&name){this.memberNames.set(id,name);if(this.memberNames.size>100)this.memberNames.delete(this.memberNames.keys().next().value);}}
  memberName(id:string){return this.memberNames.get(id)||'Member profile';}
  memberReturn(value:unknown,id:string){
    let url=this.returnUrl(value);
    for(let i=0;i<4;i++){
      const parsed=this.router.parseUrl(url);
      if(this.path(url)!=='/audit'||parsed.queryParams.memberId!==id)return url;
      url=this.returnUrl(parsed.queryParams.memberReturnTo);
    }
    return this.returnUrl(null);
  }
  private positions = new Map<string,number>();
  private pendingScroll?:{path:string;y:number};
  constructor(private router:Router, private zone:NgZone) {
    router.events.subscribe(event => {
      if(event instanceof Scroll && this.pendingScroll) {
        const pending=this.pendingScroll;this.pendingScroll=undefined;
        // Router scroll restoration runs on the Scroll event, after navigation
        // resolves. Restore on the next frame so query-only view changes stay put.
        if(this.path(router.url)===pending.path)requestAnimationFrame(()=>window.scrollTo(0,pending.y));
      }
      if(event instanceof NavigationStart && this.isList(router.url)) {
        this.positions.set(router.url,window.scrollY);
        if(this.positions.size>100)this.positions.delete(this.positions.keys().next().value);
      }
      if(event instanceof NavigationEnd && this.isList(event.urlAfterRedirects)) {
        const path=this.path(event.urlAfterRedirects);
        // A member's audit view must not replace the sidebar's global audit filters.
        if(path!=='/audit'||!router.parseUrl(event.urlAfterRedirects).queryParams.memberId)
          this.last.set(path,event.urlAfterRedirects);
      }
    });
  }
  async preservingScroll(navigate:()=>Promise<boolean>){
    const pending={path:this.path(this.router.url),y:window.scrollY};this.pendingScroll=pending;
    try{if(!await navigate()&&this.pendingScroll===pending)this.pendingScroll=undefined;}
    catch(error){if(this.pendingScroll===pending)this.pendingScroll=undefined;throw error;}
  }
  private path(url:string) { return url.split(/[?#]/)[0]; }
  private isList(url:string) { return lists.includes(this.path(url)); }
  target(path:string):string { return path; }
  query(path:string) { return this.router.parseUrl(this.last.get(path)||path).queryParams; }
  get memberQuery() { return {returnTo:this.router.url}; }
  returnUrl(value:unknown):string {
    if(typeof value==='string' && this.isList(value)) {
      try { this.router.parseUrl(value); return value; } catch {}
    }
    return this.last.get('/memberlist')||'/memberlist';
  }
  label(url:string) { return ({'/memberlist':'Members','/overdue':'Overdue memberships','/accessLog':'Access log','/reports':'Reports','/waivers':'Waivers','/automation':'Billing & automation','/audit':'Audit log','/staff/settings':'My notification settings','/payments':'Payment matching','/plans':'Plans'})[this.path(url)]||'Members'; }
  restoreScroll(position?:number) {
    const url=this.router.url, y=position===undefined?this.positions.get(url):position;
    if(y===undefined)return;
    this.zone.onStable.pipe(take(1)).subscribe(()=>requestAnimationFrame(()=>{if(this.router.url===url)window.scrollTo(0,y);}));
  }
  clear() { this.last.clear(); this.positions.clear(); this.memberNames.clear(); }
}
