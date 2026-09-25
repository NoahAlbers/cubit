import {Component, EventEmitter, Output, OnInit, OnDestroy, ChangeDetectionStrategy} from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Component({
    selector: 'app-backups', templateUrl: './backups.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class BackupsComponent implements OnInit,OnDestroy {
 @Output() ready=new EventEmitter<void>(); @Output() reviewed=new EventEmitter<void>(); historyOpen=false;reviewDirty=false;
 data:any;form:any;revision=0;error='';message='';busy=false;dirty=false;private timer:any;
 inventoryLimit=8;
 remoteInventoryLimit=8;
 get visibleRemoteBackups(){return (this.data?.runtime?.vault?.backup?.snapshots||[]).slice(0,this.remoteInventoryLimit);}
 get remoteFresh(){const r=this.data?.runtime;return !!r?.available&&!r.vaultError&&Date.now()-Date.parse(r.vault?.checkedAt)<180000;}
 get auditHealthy(){const r=this.data?.runtime;return this.remoteFresh&&r?.auditDelivery?.available&&r.auditDelivery.ok&&!r.vault?.audit?.conflicts;}
 get remoteHealthy(){const r=this.data?.runtime,b=r?.vault?.backup;return this.remoteFresh&&this.auditHealthy&&this.data?.settings?.offsiteEnabled&&b?.snapshots?.length>0&&b?.lastRestore?.ok&&!b.error&&this.usage(r.vault?.storage?.totalBytes,r.vault?.storage?.freeBytes)<80&&(!r.vault?.memory||this.usage(r.vault.memory.totalBytes,r.vault.memory.availableBytes)<90);}
 usage(total:number,available:number){return total>0?Math.max(0,Math.min(100,100*(1-available/total))):0;}
 get visibleBackups(){return (this.data?.runtime?.snapshots||[]).slice(0,this.inventoryLimit);}
 formatBytes(value:number){if(value==null||!Number.isFinite(value))return 'Not recorded';const units=['B','KB','MB','GB'];let i=0;while(value>=1024&&i<3){value/=1024;i++;}return value.toFixed(i?1:0)+' '+units[i];}
 prune(){if(!this.data?.canManageSettings)return;if(window.confirm('Keep the newest '+this.data.settings.localKeep+' local backups and remove older local copies? Off-server copies will not be changed.'))this.queue('prune');}
 days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 zones=['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','UTC'];
 constructor(private http:HttpClient){}
 ngOnInit(){this.load();this.timer=setInterval(()=>this.load(),15000);}
 ngOnDestroy(){clearInterval(this.timer);}
 load(){this.http.get<any>('/api/backups').subscribe({next:d=>{const initial=!this.data;this.data=d;if(!this.dirty){this.form={...d.settings};this.revision=d.revision;}if(initial)this.ready.emit();},error:e=>this.error=e.error?.message||'Could not load backups.'});}
 get running(){return this.data?.jobs.some(j=>['Queued','Running'].includes(j.status));}
 save(){if(this.busy||!this.data?.canManageSettings)return;this.busy=true;this.error='';this.message='';this.http.post('/api/backups/settings',{settings:this.form,revision:this.revision}).subscribe({next:()=>{this.busy=false;this.dirty=false;this.message='Backup settings saved.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save backup settings.';}});}
 queue(kind:string,snapshot?:string){if(this.busy||(kind==='prune'&&!this.data?.canManageSettings))return;this.busy=true;this.error='';this.message='';this.http.post('/api/backups/jobs',{kind,...(snapshot?{snapshot}:{}),...(kind==='prune'?{revision:this.data.revision}:{})}).subscribe({next:()=>{this.busy=false;this.message=kind==='backup'?'Backup queued. The worker will start it shortly.':kind==='prune'?'Local retention cleanup queued.':'Recovery test queued. Your working database will stay unchanged.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not queue the operation.';}});}
}
