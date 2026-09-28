import { Injectable } from '@angular/core';
@Injectable({providedIn:'root'})
export class WorkspaceService {
  available=false; locked=false; ready=false; error=''; snapshot:any=null;
  selection:'parallel'|'review'='parallel';
  constructor(){try{if(sessionStorage.getItem('cubit.workspace')==='review')this.selection='review';}catch{}}
  get parallel(){return this.available&&this.selection==='parallel';}
  get stale(){return this.snapshot&&Date.now()-Date.parse(this.snapshot.sourceTime)>30*60000;}
  choose(value:'parallel'|'review'){sessionStorage.setItem('cubit.workspace',value);sessionStorage.removeItem('cubit.parallel.snapshot');window.location.assign('/memberlist');}
}
