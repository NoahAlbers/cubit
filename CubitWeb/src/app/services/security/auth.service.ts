import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router, CanActivate, ActivatedRouteSnapshot } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable()
export class AuthService implements CanActivate {
  authToken = sessionStorage.getItem('cubit-token') || '';
  isAuthenticated$ = new BehaviorSubject<boolean>(this.validToken());
  constructor(private router: Router, private http: HttpClient) {}
  validToken() {
    try { return JSON.parse(atob(this.authToken.split('.')[1])).exp * 1000 > Date.now(); }
    catch { return false; }
  }
  get isAdmin() { try { return JSON.parse(atob(this.authToken.split('.')[1])).role === 'admin'; } catch { return false; } }
  get isDemo() { try { return JSON.parse(atob(this.authToken.split('.')[1])).aud === 'cubit-demo'; } catch { return false; } }
  get home() { return this.isAdmin ? '/memberlist' : '/portal'; }
  get accountLabel(){try{return JSON.parse(atob(this.authToken.split('.')[1])).email||'Signed in';}catch{return '';}}
  canActivate(route: ActivatedRouteSnapshot) {
    if (this.validToken()) {
      if (!route.data['portal'] && !this.isAdmin) return this.router.parseUrl('/portal');
      return true;
    }
    this.logout(); return false;
  }
  logout() {
    this.authToken = '';
    sessionStorage.removeItem('cubit-token');
    sessionStorage.removeItem('cubit-waiver-preview');
    localStorage.removeItem('token');
    this.isAuthenticated$.next(false);
    this.router.navigateByUrl('/');
  }
  login(email: string, password: string) {
    return this.http.post<any>('/login', { email, password }).pipe(tap(result => {
      sessionStorage.removeItem('cubit-waiver-preview');
      this.authToken = result.token;
      sessionStorage.setItem('cubit-token', result.token);
      this.isAuthenticated$.next(true);
    }));
  }
}
