import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OrganizationService } from '../../services/organization.service';
import { AuthService } from '../../services/security/auth.service';
import { DraftGuard } from '../../services/draft-guard';
import { validEmail } from '../../services/contact-format';

@Component({selector:'app-organization',standalone:false,templateUrl:'./organization.component.html',changeDetection:ChangeDetectionStrategy.Eager})
export class OrganizationComponent implements OnInit {
  settings:any;baseline='';staff:any[]=[];currentUserId='';loading=true;busy=false;error='';message='';
  edit:any=null;editBaseline='';search='';candidates:any[]=[];searched=false;searching=false;link='';expiresAt='';
  constructor(private http:HttpClient,public organization:OrganizationService,public auth:AuthService,private drafts:DraftGuard){}
  ngOnInit(){this.load();}
  async load(preserveDraft=false){this.loading=true;try{const d:any=await firstValueFrom(this.http.get('/api/organization'));if(!preserveDraft||!this.settingsDirty){this.settings={...d.settings};this.baseline=JSON.stringify(this.settings);}this.staff=d.staff;this.currentUserId=d.currentUserId;this.error='';}catch(e){this.error=e.error?.message||'Could not load organization management.';}finally{this.loading=false;}}
  get settingsDirty(){return !!this.settings&&JSON.stringify(this.settings)!==this.baseline;}
  get accountDirty(){return !!this.edit&&JSON.stringify(this.edit)!==this.editBaseline;}
  hasUnsavedChanges(){return this.settingsDirty||this.accountDirty;}
  discardDraft(){if(this.baseline)this.settings=JSON.parse(this.baseline);this.edit=null;this.link='';}
  roleLabel(role:string){return role==='admin'?'Administration':role==='staff'?'Staff User':'Member';}
  validSettings(){return !!this.settings?.name?.trim()&&this.settings.name.trim().length<=120&&validEmail(this.settings.supportEmail);}
  async saveSettings(){if(this.busy||!this.validSettings())return;this.busy=true;this.error='';this.message='';try{const d:any=await firstValueFrom(this.http.put('/api/organization/settings',{name:this.settings.name,supportEmail:this.settings.supportEmail,revision:this.settings.revision}));this.settings=d;this.baseline=JSON.stringify(d);this.organization.accept(d);this.message='Organization details saved. The login page and contact-help links now use these details.';}catch(e){this.error=e.error?.message||'Could not save organization details.';}finally{this.busy=false;}}
  async select(person?:any){if(this.accountDirty&&!await this.drafts.confirmDiscard())return;this.edit=person?{...person,reason:''}:{firstName:'',lastName:'',email:'',role:'staff',loginDisabled:false,reason:''};this.editBaseline=JSON.stringify(this.edit);this.link='';this.error='';this.message='';}
  async closeEditor(){if(this.accountDirty&&!await this.drafts.confirmDiscard())return;this.edit=null;this.link='';}
  async findMembers(){if(this.search.trim().length<2||this.searching)return;this.searching=true;this.error='';try{const d:any=await firstValueFrom(this.http.get('/api/organization/candidates',{params:{q:this.search.trim()}}));this.candidates=d.rows;this.searched=true;}catch(e){this.error=e.error?.message||'Could not find members.';}finally{this.searching=false;}}
  validAccount(){return this.edit?.firstName?.trim()&&this.edit?.lastName?.trim()&&validEmail(this.edit.email)&&(!this.edit.id||this.edit.reason?.trim())&&!this.edit.protected;}
  async saveAccount(){if(this.busy||!this.validAccount())return;this.busy=true;this.error='';this.message='';try{
    const b={firstName:this.edit.firstName,lastName:this.edit.lastName,email:this.edit.email,role:this.edit.role};
    const saved:any=await firstValueFrom(this.edit.id?this.http.put('/api/organization/staff/'+this.edit.id,{...b,loginDisabled:this.edit.loginDisabled,staffVersion:this.edit.staffVersion,reason:this.edit.reason}):this.http.post('/api/organization/staff',b));
    const self=saved.id===this.currentUserId;this.edit={...saved,reason:''};this.editBaseline=JSON.stringify(this.edit);this.link='';this.candidates=[];this.searched=false;
    if(self){this.auth.logout();return;}
    await this.load(true);this.message=saved.role==='member'?'Staff access removed. The member record and history remain.':'Staff account saved. Account changes end existing sessions. Share a private invitation if this is a new login.';
  }catch(e){this.error=e.error?.message||'Could not save this account.';}finally{this.busy=false;}}
  async prepareLink(){if(this.busy||this.accountDirty||!this.edit?.id||this.edit.protected||this.edit.loginDisabled)return;this.busy=true;this.error='';this.link='';try{const d:any=await firstValueFrom(this.http.post('/api/account/members/'+this.edit.id+'/link',{purpose:this.edit.hasPassword?'reset':'invite'}));this.link=location.origin+d.path;this.expiresAt=d.expiresAt;}catch(e){this.error=e.error?.message||'Could not prepare the private link.';}finally{this.busy=false;}}
}
