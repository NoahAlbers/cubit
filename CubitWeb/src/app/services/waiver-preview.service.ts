import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable({providedIn:'root'})
export class WaiverPreviewService {
  constructor(private http:HttpClient){}
  get unlocked(){try{return JSON.parse(atob((sessionStorage.getItem('cubit-waiver-preview')||'').split('.')[1])).exp*1000>Date.now();}catch{return false;}}
  unlock(password:string){return this.http.post<any>('/api/waivers/unlock',{password}).pipe(tap(r=>sessionStorage.setItem('cubit-waiver-preview',r.token)));}
  lock(){sessionStorage.removeItem('cubit-waiver-preview');}
}
