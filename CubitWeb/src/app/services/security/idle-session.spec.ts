import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { IdleSessionService, IDLE_WARNING_MS, IDLE_SIGNOUT_MS } from './idle-session.service';
import { DraftGuard } from '../draft-guard';

describe('Browser inactivity timeout',()=>{
  const key='cubit-idle.v1.workspace.synthetic';
  let service:IdleSessionService,auth:any,dialog:any,navigation:any,choice:Subject<string|undefined>;
  function start(signedIn=true){
    auth={isDemo:false,memberId:'synthetic',isAuthenticated$:new BehaviorSubject(signedIn),validToken:()=>auth.isAuthenticated$.value,logout:vi.fn(()=>auth.isAuthenticated$.next(false))};
    dialog={open:vi.fn(()=>{choice=new Subject();return {beforeClosed:()=>choice,close:(value?:string)=>choice.next(value)};}),closeAll:vi.fn(()=>choice?.next(undefined))};
    navigation={clear:vi.fn()};
    service=new IdleSessionService(auth,dialog,navigation,{run:(fn:any)=>fn(),runOutsideAngular:(fn:any)=>fn()} as any);
  }
  function activity(){(service as any).activity({isTrusted:true});}
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-25T18:00:00Z'));localStorage.clear();sessionStorage.clear();});
  afterEach(()=>{service?.ngOnDestroy();vi.useRealTimers();localStorage.clear();sessionStorage.clear();});

  it('prompts at ten minutes and signs out at twelve without a response',()=>{
    start();vi.advanceTimersByTime(IDLE_WARNING_MS-1);expect(dialog.open).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);expect(dialog.open).toHaveBeenCalledOnce();expect(dialog.open.mock.calls[0][1].data.remaining.value).toBe(120);
    activity();vi.advanceTimersByTime(60000);expect(dialog.open.mock.calls[0][1].data.remaining.value).toBe(60);
    vi.advanceTimersByTime(60000);expect(auth.logout).toHaveBeenCalledWith('inactive');expect(navigation.clear).toHaveBeenCalledOnce();expect(JSON.parse(localStorage.getItem(key)!).loggedOut).toBe(true);
  });
  it('counts real interaction, but ignores synthetic events and background polling',()=>{
    start();vi.advanceTimersByTime(9*60000);activity();vi.advanceTimersByTime(9*60000);expect(dialog.open).not.toHaveBeenCalled();
    (service as any).activity({isTrusted:false});vi.advanceTimersByTime(60000);expect(dialog.open).toHaveBeenCalledOnce();
  });
  it('requires an explicit stay response and starts a fresh ten-minute window',()=>{
    start();vi.advanceTimersByTime(IDLE_WARNING_MS);activity();expect(dialog.open).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(119000);choice.next('stay');vi.advanceTimersByTime(IDLE_WARNING_MS-1000);expect(auth.logout).not.toHaveBeenCalled();expect(dialog.open).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);expect(dialog.open).toHaveBeenCalledTimes(2);
  });
  it('preserves the deadline through refreshes and expires before accepting input after sleep',()=>{
    start();vi.advanceTimersByTime(9*60000);service.ngOnDestroy();start();vi.advanceTimersByTime(60000);expect(dialog.open).toHaveBeenCalledOnce();
    vi.setSystemTime(Date.now()+3*60000);activity();expect(auth.logout).toHaveBeenCalledWith('inactive');
  });
  it('shares activity and sign-out only with matching account tabs',()=>{
    start();vi.advanceTimersByTime(IDLE_WARNING_MS);localStorage.setItem(key,JSON.stringify({lastActivity:Date.now(),loggedOut:false}));window.dispatchEvent(new StorageEvent('storage',{key}));
    vi.advanceTimersByTime(9000);expect(auth.logout).not.toHaveBeenCalled();expect(dialog.open).toHaveBeenCalledOnce();
    localStorage.setItem('cubit-idle.v1.workspace.other',JSON.stringify({lastActivity:Date.now(),loggedOut:true}));window.dispatchEvent(new StorageEvent('storage',{key:'cubit-idle.v1.workspace.other'}));expect(auth.logout).not.toHaveBeenCalled();
    localStorage.setItem(key,JSON.stringify({lastActivity:Date.now(),loggedOut:true}));window.dispatchEvent(new StorageEvent('storage',{key}));expect(auth.logout).toHaveBeenCalledWith('inactive');
  });
  it('starts only after authentication and resets old timeout state on a new login',()=>{
    localStorage.setItem(key,JSON.stringify({lastActivity:Date.now()-IDLE_SIGNOUT_MS,loggedOut:true}));start(false);vi.advanceTimersByTime(IDLE_SIGNOUT_MS);expect(dialog.open).not.toHaveBeenCalled();
    auth.isAuthenticated$.next(true);vi.advanceTimersByTime(IDLE_WARNING_MS);expect(dialog.open).toHaveBeenCalledOnce();choice.next('logout');expect(auth.logout).toHaveBeenCalledWith('inactive');
    vi.advanceTimersByTime(IDLE_SIGNOUT_MS);expect(auth.logout).toHaveBeenCalledOnce();
  });
  it('does not let unsaved-change confirmation block an expired sign-in',async()=>{
    start(false);const guard=new DraftGuard(dialog,auth),page={hasUnsavedChanges:()=>true,discardDraft:vi.fn(),saveDraft:vi.fn()};
    expect(await guard.canDeactivate(page)).toBe(true);expect(dialog.open).not.toHaveBeenCalled();expect(page.saveDraft).not.toHaveBeenCalled();
  });
});
