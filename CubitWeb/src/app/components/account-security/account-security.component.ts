import qr from 'qrcode-generator';
import { Component, OnInit, ChangeDetectionStrategy, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/security/auth.service';

@Component({selector:'app-account-security',standalone:true,imports:[CommonModule,FormsModule,RouterLink],
  changeDetection:ChangeDetectionStrategy.Eager,templateUrl:'./account-security.component.html',
  host:{'[class.embedded]':'embedded'},
  styles:[`:host.embedded{max-width:none;margin:0}:host.embedded .panel{padding:0;border:0;box-shadow:none;margin:0}:host{display:block;max-width:780px;margin:auto}.panel{padding:24px;margin-bottom:18px}label{display:grid;gap:6px;margin:16px 0}input,textarea{width:100%;box-sizing:border-box}code{display:block;overflow-wrap:anywhere;padding:12px;background:#eef4fc}li{padding:4px} .actions{display:flex;gap:8px;flex-wrap:wrap} .error{color:#a71924}`]})
export class AccountSecurityComponent implements OnInit {
  @Input() embedded=false; @Input() enrollmentBlocked=false;
  mode='security'; memberId=''; memberName=''; password=''; confirmPassword=''; code='';
  token=''; error=''; message=''; busy=false; loading=true; state:any;
  demoWorkspace=false;
  setupQr='';
  confirmForget=false;
  forgetComputers(){return this.action(async()=>{await firstValueFrom(this.http.post('/api/account/trusted-computers/forget',{}));this.auth.logout();});}
  setup:any; recoveryCodes:string[]=[]; link=''; expiresAt=''; email='';
  constructor(private route:ActivatedRoute,private http:HttpClient,public auth:AuthService){}
  hasUnsavedChanges(){return this.recoveryCodes.length>0;}
  discardDraft(){this.recoveryCodes=[];}
  finishSetup(){this.recoveryCodes=[];this.auth.logout();}
  @HostListener('window:beforeunload',['$event']) protectCodes(event:BeforeUnloadEvent){if(this.recoveryCodes.length){event.preventDefault();event.returnValue='';}}
  async ngOnInit(){
    this.mode=this.route.snapshot.data['mode']||'security';this.memberId=this.route.snapshot.paramMap.get('id')||'';
    if(this.mode==='activate'){
      this.token=new URLSearchParams(this.route.snapshot.fragment||'').get('token')||'';
      this.demoWorkspace=this.token.startsWith('d.');
      if(!this.token)this.error='This link is incomplete. Ask staff for a new link.';
      this.loading=false;return;
    }
    try{
      if(this.memberId){const member=await firstValueFrom(this.http.get<any>('/member/'+encodeURIComponent(this.memberId)));this.memberName=[member.firstName,member.lastName].filter(Boolean).join(' ');this.email=member.email;}
      else this.state=await firstValueFrom(this.http.get('/api/account'));
    }catch(e:any){this.error=e.error?.message||'Could not load account security.';}finally{this.loading=false;}
  }
  async action(fn:()=>Promise<void>){if(this.busy||this.enrollmentBlocked)return;this.busy=true;this.error='';try{await fn();}catch(e:any){this.error=e.error?.message||'Could not complete that request. Please try again.';}finally{this.busy=false;}}
  prepare(purpose:string){return this.action(async()=>{this.link='';const r=await firstValueFrom(this.http.post<any>('/api/account/members/'+this.memberId+'/link',{purpose}));this.link=window.location.origin+r.path;this.expiresAt=r.expiresAt;this.email=r.email;});}
  requestPasswordReset(){if(!this.state?.passwordResetEmailAvailable||this.recoveryCodes.length)return;return this.action(async()=>{const r=await firstValueFrom(this.http.post<{message:string}>('/api/account/password-reset/request',{}));this.message=r.message;});}
  startMfa(){return this.action(async()=>{this.setup=await firstValueFrom(this.http.post('/api/account/mfa/start',{password:this.password}));this.setupQr='';try{const image=qr(0,'M');image.addData(this.setup.uri);image.make();this.setupQr=image.createDataURL(5,20);}catch{this.error='The QR code could not be generated. Use the setup key below.';}});}
  confirmMfa(){return this.action(async()=>{
    const r=await firstValueFrom(this.http.post<any>('/api/account/mfa/confirm',{password:this.password,code:this.code}));
    this.recoveryCodes=r.recoveryCodes;this.setup=null;this.setupQr='';this.password='';this.code='';this.state.mfaEnabled=true;
    // The response contains one-time recovery codes. Keep them visible until the
    // user explicitly leaves; the old session is already revoked on the server.
    this.message='Authenticator enabled. Save these recovery codes before signing in again.';
  });}
  redeem(){return this.action(async()=>{
    if(this.password!==this.confirmPassword){this.error='The passwords do not match.';return;}
    await firstValueFrom(this.http.post('/api/account/redeem',{token:this.token,password:this.password,code:this.code}));
    this.password='';this.confirmPassword='';this.code='';this.token='';this.message='Password saved. Sign in with your new password.';
  });}
}
