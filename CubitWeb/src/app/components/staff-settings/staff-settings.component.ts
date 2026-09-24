import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Component({
    selector: 'app-staff-settings', templateUrl: './staff-settings.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class StaffSettingsComponent implements OnInit {
  preferences:any;email='';baseline='';error='';message='';busy=false;preview:any[]=[];
  notices:any[]=[];noticeError='';
  constructor(private http:HttpClient){}
  ngOnInit(){this.load();this.loadNotices();}
  loadNotices(){this.http.get<any>('/api/account/notices').subscribe({next:d=>this.notices=d.rows,error:()=>this.noticeError='Could not load account notices.'});}
  acknowledge(id:string){this.http.post('/api/account/notices/'+id+'/acknowledge',{}).subscribe({next:()=>this.loadNotices(),error:()=>this.noticeError='Could not acknowledge that account notice.'});}
  accept(d:any){const p=d.preferences;this.preferences={enabled:p.enabled,unknownFobs:p.unknownFobs,refusedFobs:p.refusedFobs,dedupeMinutes:p.dedupeMinutes,revision:p.revision};this.email=d.email;this.baseline=JSON.stringify(this.preferences);}
  load(){this.error='';this.http.get('/api/cubit/staff/preferences').subscribe({next:d=>this.accept(d),error:e=>this.error=e.error?.message||'Could not load preferences.'});}
  hasUnsavedChanges(){return !!this.preferences&&JSON.stringify(this.preferences)!==this.baseline;}
  valid(){return Number.isInteger(this.preferences?.dedupeMinutes)&&this.preferences.dedupeMinutes>=1&&this.preferences.dedupeMinutes<=1440;}
  save(){if(this.busy||!this.valid())return;this.busy=true;this.error='';this.message='';this.preview=[];this.http.put('/api/cubit/staff/preferences',this.preferences).subscribe({next:d=>{this.accept(d);this.busy=false;this.message='Preferences saved. Email delivery remains off.';},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save preferences.';}});}
  previewAlerts(){this.busy=true;this.error='';this.http.post<any>('/api/cubit/staff/preferences/preview',{}).subscribe({next:d=>{this.preview=d.results;this.busy=false;},error:e=>{this.busy=false;this.error=e.error?.message||'Could not preview alerts.';}});}
}
