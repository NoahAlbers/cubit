import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { ListNavigationService } from '../list-navigation.service';
import { IdleWarningComponent } from '../../components/shared/idle-warning.component';

export const IDLE_WARNING_MS = 10 * 60 * 1000;
export const IDLE_SIGNOUT_MS = 12 * 60 * 1000;
type IdleState = { lastActivity: number; loggedOut: boolean };

/** Browser inactivity, independent of API polling and the trusted-computer cookie. */
@Injectable({providedIn:'root'})
export class IdleSessionService implements OnDestroy {
  private key = '';
  private lastActivity = 0;
  private lastStored = 0;
  private timer?: ReturnType<typeof setInterval>;
  private warning?: MatDialogRef<IdleWarningComponent>;
  private remaining = new BehaviorSubject(120);
  private subscription: Subscription;
  private initial = true;
  private readonly inputEvents = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'touchmove'];

  constructor(private auth: AuthService, private dialog: MatDialog, private navigation: ListNavigationService, private zone: NgZone) {
    this.subscription = auth.isAuthenticated$.subscribe(signedIn => {
      const freshLogin = !this.initial;
      this.initial = false;
      this.stop();
      if (signedIn && auth.validToken()) this.start(freshLogin);
    });
  }

  private read(): IdleState | null {
    try {
      const state = JSON.parse(localStorage.getItem(this.key) || sessionStorage.getItem(this.key) || 'null');
      return state && Number.isFinite(state.lastActivity) && state.lastActivity > 0 && state.lastActivity <= Date.now() + 1000 && typeof state.loggedOut === 'boolean' ? state : null;
    } catch { return null; }
  }
  private write(loggedOut = false) {
    const value = JSON.stringify({lastActivity:this.lastActivity,loggedOut});
    // Only activity time and a sign-out flag are stored; no credentials or profile details.
    try { sessionStorage.setItem(this.key,value); } catch {}
    try { localStorage.setItem(this.key,value); } catch {}
    this.lastStored = Date.now();
  }
  private start(freshLogin: boolean) {
    this.key = 'cubit-idle.v1.' + (this.auth.isDemo ? 'demo.' : 'workspace.') + this.auth.memberId;
    const saved = freshLogin ? null : this.read();
    this.lastActivity = saved?.lastActivity ?? Date.now();
    if (saved?.loggedOut) { this.expire(); return; }
    if (!saved) this.write();
    this.zone.runOutsideAngular(() => {
      this.inputEvents.forEach(name => document.addEventListener(name,this.activity,{capture:true,passive:true}));
      document.addEventListener('visibilitychange',this.check);
      window.addEventListener('focus',this.check);
      window.addEventListener('pageshow',this.check);
      window.addEventListener('storage',this.storageChanged);
      this.timer = setInterval(this.check,1000);
    });
    this.check();
  }
  private activity = (event: Event) => {
    if (!event.isTrusted || document.hidden || !this.key) return;
    // Check the old deadline before counting resumed input after browser sleep.
    this.check();
    if (!this.key || this.warning) return;
    this.lastActivity = Date.now();
    if (Date.now() - this.lastStored >= 1000) this.write();
  };
  private storageChanged = (event: StorageEvent) => {
    if (event.key === this.key) this.check();
  };
  private check = () => {
    if (!this.key) return;
    if (!this.auth.validToken()) { this.zone.run(() => this.auth.logout()); return; }
    const shared = this.read();
    if (shared?.loggedOut) { this.expire(); return; }
    if (shared && shared.lastActivity > this.lastActivity) this.lastActivity = shared.lastActivity;
    const elapsed = Date.now() - this.lastActivity;
    if (elapsed >= IDLE_SIGNOUT_MS) { this.expire(); return; }
    if (elapsed < IDLE_WARNING_MS) { this.closeWarning(); return; }
    this.zone.run(() => {
      this.remaining.next(Math.ceil((IDLE_SIGNOUT_MS - elapsed) / 1000));
      if (this.warning) return;
      const ref = this.dialog.open(IdleWarningComponent,{
        width:'460px',maxWidth:'calc(100vw - 32px)',disableClose:true,closeOnNavigation:false,
        ariaLabel:'Stay signed in?',role:'alertdialog',data:{remaining:this.remaining},
      });
      this.warning = ref;
      ref.beforeClosed().subscribe(choice => {
        if (this.warning === ref) this.warning = undefined;
        if (choice === 'stay') this.stay();
        if (choice === 'logout') this.expire();
      });
    });
  };
  private stay() {
    if (!this.key) return;
    const shared = this.read();
    if (shared?.loggedOut || Date.now() - Math.max(this.lastActivity,shared?.lastActivity || 0) >= IDLE_SIGNOUT_MS) { this.expire(); return; }
    this.lastActivity = Date.now();
    this.write();
    this.closeWarning();
  }
  private expire() {
    if (!this.key) return;
    this.write(true);
    this.zone.run(() => {
      this.dialog.closeAll();
      this.navigation.clear();
      // This browser's tabs sign out together; active sessions on other devices
      // are not revoked by an unattended tab or a shared synthetic-demo login.
      this.auth.logout('inactive');
    });
  }
  private closeWarning() {
    if (!this.warning) return;
    const ref = this.warning;
    this.warning = undefined;
    this.zone.run(() => ref.close());
  }
  private stop() {
    clearInterval(this.timer);
    this.key = '';
    this.closeWarning();
    this.inputEvents.forEach(name => document.removeEventListener(name,this.activity,true));
    document.removeEventListener('visibilitychange',this.check);
    window.removeEventListener('focus',this.check);
    window.removeEventListener('pageshow',this.check);
    window.removeEventListener('storage',this.storageChanged);
  }
  ngOnDestroy() { this.stop(); this.subscription.unsubscribe(); this.remaining.complete(); }
}
