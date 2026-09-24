import {Component, OnInit, ViewChild, ChangeDetectionStrategy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AccountSecurityComponent} from '../account-security/account-security.component';
import {AuthService} from '../../services/security/auth.service';

interface Preferences {enabled:boolean;unknownFobs:boolean;refusedFobs:boolean;dedupeMinutes:number;revision:number;}
interface PreferenceResponse {preferences:Preferences;email:string;}
interface AccountNotice {id:string;memberId:string;previousEmail:string;newEmail:string;createdAt:string;}
interface AlertPreview {at:string;fob:string;outcome:string;decision:string;}

@Component({selector:'app-staff-settings',templateUrl:'./staff-settings.component.html',changeDetection:ChangeDetectionStrategy.Eager,standalone:false})
export class StaffSettingsComponent implements OnInit {
  @ViewChild(AccountSecurityComponent) security?:AccountSecurityComponent;
  preferences?:Preferences;email='';baseline='';error='';message='';busy=false;preview:AlertPreview[]=[];
  notices:AccountNotice[]=[];noticeError='';
  constructor(private http:HttpClient,public auth:AuthService){}
  ngOnInit(){this.load();this.loadNotices();}
  get protectingCodes(){return !!this.security?.recoveryCodes.length;}
  get locked(){return this.busy||!!this.security?.busy||this.protectingCodes;}
  loadNotices(){if(this.protectingCodes)return;this.http.get<{rows:AccountNotice[]}>('/api/account/notices').subscribe({next:d=>this.notices=d.rows,error:()=>this.noticeError='Could not load account notices.'});}
  acknowledge(id:string){if(this.locked)return;this.busy=true;this.http.post('/api/account/notices/'+id+'/acknowledge',{}).subscribe({next:()=>{this.busy=false;this.loadNotices();},error:()=>{this.busy=false;this.noticeError='Could not acknowledge that account notice.';}});}
  accept(d:PreferenceResponse){const p=d.preferences;this.preferences={enabled:p.enabled,unknownFobs:p.unknownFobs,refusedFobs:p.refusedFobs,dedupeMinutes:p.dedupeMinutes,revision:p.revision};this.email=d.email;this.baseline=JSON.stringify(this.preferences);}
  load(){if(this.protectingCodes)return;this.error='';this.http.get<PreferenceResponse>('/api/cubit/staff/preferences').subscribe({next:d=>this.accept(d),error:e=>this.error=e.error?.message||'Could not load preferences.'});}
  preferencesDirty(){return !!this.preferences&&JSON.stringify(this.preferences)!==this.baseline;}
  hasUnsavedChanges(){return this.preferencesDirty()||!!this.security?.hasUnsavedChanges();}
  discardDraft(){if(this.baseline)this.preferences=JSON.parse(this.baseline);this.security?.discardDraft();}
  cancelPreferences(){if(this.locked)return;if(this.baseline)this.preferences=JSON.parse(this.baseline);this.error='';this.message='';}
  valid(){const n=this.preferences?.dedupeMinutes;return typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=1440;}
  save(){if(this.locked||!this.valid()||!this.preferencesDirty())return;this.busy=true;this.error='';this.message='';this.preview=[];this.http.put<PreferenceResponse>('/api/cubit/staff/preferences',this.preferences).subscribe({next:d=>{this.accept(d);this.busy=false;this.message='Preferences saved. Email delivery remains off.';},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save preferences.';}});}
  previewAlerts(){if(this.locked||this.preferencesDirty())return;this.busy=true;this.error='';this.http.post<{results:AlertPreview[]}>('/api/cubit/staff/preferences/preview',{}).subscribe({next:d=>{this.preview=d.results;this.busy=false;},error:e=>{this.busy=false;this.error=e.error?.message||'Could not preview alerts.';}});}
}
