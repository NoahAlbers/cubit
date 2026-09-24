import {Component, OnInit, ViewChild, ChangeDetectionStrategy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AccountSecurityComponent} from '../account-security/account-security.component';
import {AuthService} from '../../services/security/auth.service';

interface Topic {id:string;group:string;label:string;description:string;}
interface Delivery {quietHours:boolean;start:string;end:string;timezone:string;}
interface Preferences {topics:Record<string,boolean>;delivery:Delivery;enabled:boolean;unknownFobs:boolean;refusedFobs:boolean;dedupeMinutes:number;revision:number;}
interface PreferenceResponse {preferences:Preferences;email:string;topics?:Topic[];}
interface AccountNotice {id:string;memberId:string;previousEmail:string;newEmail:string;createdAt:string;}
interface AlertPreview {at:string;fob:string;outcome:string;decision:string;}

@Component({selector:'app-staff-settings',templateUrl:'./staff-settings.component.html',changeDetection:ChangeDetectionStrategy.Eager,standalone:false})
export class StaffSettingsComponent implements OnInit {
  @ViewChild(AccountSecurityComponent) security?:AccountSecurityComponent;
  preferences?:Preferences;email='';baseline='';error='';message='';busy=false;preview:AlertPreview[]=[];
  topics:Topic[]=[];topicPreview:{topic:string;group:string;decision:string}[]=[];
  get topicGroups(){return [...new Set(this.topics.map(t=>t.group))];}
  groupTopics(group:string){return this.topics.filter(t=>t.group===group);}
  selectedCount(group:string){return this.groupTopics(group).filter(t=>this.preferences?.topics[t.id]).length;}
  notices:AccountNotice[]=[];noticeError='';
  constructor(private http:HttpClient,public auth:AuthService){}
  ngOnInit(){this.load();this.loadNotices();}
  get protectingCodes(){return !!this.security?.recoveryCodes.length;}
  get locked(){return this.busy||!!this.security?.busy||this.protectingCodes;}
  loadNotices(){if(this.protectingCodes)return;this.http.get<{rows:AccountNotice[]}>('/api/account/notices').subscribe({next:d=>this.notices=d.rows,error:()=>this.noticeError='Could not load account notices.'});}
  acknowledge(id:string){if(this.locked)return;this.busy=true;this.http.post('/api/account/notices/'+id+'/acknowledge',{}).subscribe({next:()=>{this.busy=false;this.loadNotices();},error:()=>{this.busy=false;this.noticeError='Could not acknowledge that account notice.';}});}
  accept(d:PreferenceResponse){const p=d.preferences;this.preferences={enabled:p.enabled,unknownFobs:p.unknownFobs,refusedFobs:p.refusedFobs,dedupeMinutes:p.dedupeMinutes,revision:p.revision,topics:{...(p.topics||{})},delivery:{...(p.delivery||{quietHours:false,start:'22:00',end:'08:00',timezone:'UTC'})}};if(d.topics)this.topics=d.topics;this.email=d.email;this.baseline=JSON.stringify(this.preferences);}
  load(){if(this.protectingCodes)return;this.error='';this.http.get<PreferenceResponse>('/api/cubit/staff/preferences').subscribe({next:d=>this.accept(d),error:e=>this.error=e.error?.message||'Could not load preferences.'});}
  preferencesDirty(){return !!this.preferences&&JSON.stringify(this.preferences)!==this.baseline;}
  hasUnsavedChanges(){return this.preferencesDirty()||!!this.security?.hasUnsavedChanges();}
  discardDraft(){if(this.baseline)this.preferences=JSON.parse(this.baseline);this.security?.discardDraft();}
  cancelPreferences(){if(this.locked)return;if(this.baseline)this.preferences=JSON.parse(this.baseline);this.error='';this.message='';}
  valid(){const n=this.preferences?.dedupeMinutes;if(!(typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=1440))return false;const d=this.preferences!.delivery;try{new Intl.DateTimeFormat('en',{timeZone:d.timezone});}catch{return false;}return /^([01]\d|2[0-3]):[0-5]\d$/.test(d.start)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end)&&(!d.quietHours||d.start!==d.end);}
  save(){if(this.locked||!this.valid()||!this.preferencesDirty())return;this.busy=true;this.error='';this.message='';this.preview=[];this.topicPreview=[];this.http.put<PreferenceResponse>('/api/cubit/staff/preferences',this.preferences).subscribe({next:d=>{this.accept(d);this.busy=false;this.message='Preferences saved. Email delivery remains off.';},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save preferences.';}});}
  previewAlerts(){if(this.locked||this.preferencesDirty())return;this.busy=true;this.error='';this.http.post<{results:AlertPreview[];examples?:{topic:string;group:string;decision:string}[]}>('/api/cubit/staff/preferences/preview',{}).subscribe({next:d=>{this.preview=d.results;this.topicPreview=d.examples||[];this.busy=false;},error:e=>{this.busy=false;this.error=e.error?.message||'Could not preview alerts.';}});}
}
