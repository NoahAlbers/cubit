import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuthService  {
  signingOut = false;
  authToken = sessionStorage.getItem('cubit-token') || '';
  isAuthenticated$ = new BehaviorSubject<boolean>(this.validToken());
  constructor(private router: Router, private http: HttpClient) {}
  validToken() {
    try { return JSON.parse(atob(this.authToken.split('.')[1])).exp * 1000 > Date.now(); }
    catch { return false; }
  }
  get isAdmin() { try { return JSON.parse(atob(this.authToken.split('.')[1])).role === 'admin'; } catch { return false; } }
  get isStaff() { try { return ['admin','staff'].includes(JSON.parse(atob(this.authToken.split('.')[1])).role); } catch { return false; } }
  get roleLabel(){return this.isAdmin?'Administration':this.isStaff?'Staff User':'Member';}
  get isDemo() { try { return JSON.parse(atob(this.authToken.split('.')[1])).aud === 'cubit-demo'; } catch { return false; } }
  get home() { return this.isStaff ? '/memberlist' : '/portal'; }
  get accountLabel(){try{return JSON.parse(atob(this.authToken.split('.')[1])).email||'Signed in';}catch{return '';}}
  canActivate(route: ActivatedRouteSnapshot) {
    if (this.validToken()) {
      if(route.data['administration']&&!this.isAdmin)return this.router.parseUrl(this.home);
      if (!route.data['portal'] && !this.isStaff) return this.router.parseUrl('/portal');
      return true;
    }
    this.logout(); return false;
  }
  logout() {
    this.authToken = '';
    sessionStorage.removeItem('cubit-token');
    localStorage.removeItem('token');
    this.isAuthenticated$.next(false);
    this.router.navigateByUrl('/');
  }
  async signOutEverywhere() {
    // Leave the token in place until the authenticated server revocation finishes.
    // Automatic handling of an expired token still uses local-only logout().
    await firstValueFrom(this.http.post('/logout', {}));
    this.logout();
  }
  login(email: string, password: string, code = '', workspace = '') {
    return this.http.post<any>('/login', { email, password, code, workspace }).pipe(tap(result => {
      this.authToken = result.token;
      sessionStorage.setItem('cubit-token', result.token);
      this.isAuthenticated$.next(true);
    }));
  }
}
