import {Component, EventEmitter, Output, OnInit, OnDestroy, ChangeDetectionStrategy} from '@angular/core';
import { HttpClient } from '@angular/common/http';
@Component({
    selector: 'app-backups', templateUrl: './backups.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class BackupsComponent implements OnInit,OnDestroy {
 @Output() ready=new EventEmitter<void>();
 data:any;form:any;revision=0;error='';message='';busy=false;dirty=false;private timer:any;
 days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 zones=['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','UTC'];
 constructor(private http:HttpClient){}
 ngOnInit(){this.load();this.timer=setInterval(()=>this.load(),15000);}
 ngOnDestroy(){clearInterval(this.timer);}
 load(){this.http.get<any>('/api/backups').subscribe({next:d=>{const initial=!this.data;this.data=d;if(!this.dirty){this.form={...d.settings};this.revision=d.revision;}if(initial)this.ready.emit();},error:e=>this.error=e.error?.message||'Could not load backups.'});}
 get running(){return this.data?.jobs.some(j=>['Queued','Running'].includes(j.status));}
 save(){if(this.busy)return;this.busy=true;this.error='';this.message='';this.http.post('/api/backups/settings',{settings:this.form,revision:this.revision}).subscribe({next:()=>{this.busy=false;this.dirty=false;this.message='Backup settings saved.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not save backup settings.';}});}
 queue(kind:string){if(this.busy)return;this.busy=true;this.error='';this.message='';this.http.post('/api/backups/jobs',{kind}).subscribe({next:()=>{this.busy=false;this.message=kind==='backup'?'Backup queued. The worker will start it shortly.':'Recovery test queued. Your working database will stay unchanged.';this.load();},error:e=>{this.busy=false;this.error=e.error?.message||'Could not queue the operation.';}});}
}
