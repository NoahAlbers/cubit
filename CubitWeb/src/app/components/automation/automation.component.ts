import { Component, OnInit } from '@angular/core';
import { ListNavigationService } from '../../services/list-navigation.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
@Component({selector:'app-automation',templateUrl:'./automation.component.html'})
export class AutomationComponent implements OnInit {
  data:any; settings:any; members:any[]=[]; error='';message='';busy=false;preview:any;selected:any={};
  simulation:any={id:'',resourceId:'',subscriptionId:'',parentResourceId:'',kind:'payment',amount:60,eventDate:''};
  constructor(private http:HttpClient, public navigation:ListNavigationService, private route:ActivatedRoute, private router:Router){}
  ngOnInit(){const d=new Date();this.simulation.eventDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;this.newIds();this.load();
    this.http.get<any[]>('/member').subscribe({next:d=>this.members=d.sort((a,b)=>`${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)),error:e=>this.error=e.error?.message||'Could not load member matching options.'});}
  newIds(){this.simulation.id='event-'+crypto.randomUUID();this.simulation.resourceId='resource-'+crypto.randomUUID();}
  load(){this.http.get<any>('/api/cubit/automation').subscribe({next:d=>{this.data=d;this.settings={...d.settings};},error:e=>this.error=e.error?.message||'Could not load automation.'});}
  post(path:string,body:any,done:(r:any)=>void){if(this.busy)return;this.busy=true;this.error='';this.message='';this.http.post<any>('/api/cubit/'+path,body).subscribe({next:r=>{this.busy=false;done(r);},error:e=>{this.busy=false;this.error=e.error?.message||'Could not complete the action.';}});}
  save(){this.post('automation/settings',this.settings,()=>{this.preview=null;this.message='Settings saved. Grace changes apply to access eligibility immediately.';this.load();});}
  run(isPreview:boolean){this.post('automation/run',{preview:isPreview},r=>{this.preview=r;if(!isPreview){this.message='Billing and access processing completed.';this.preview=null;this.load();}});}
  simulate(){this.post('automation/events/simulate',this.simulation,()=>{this.message='Test event added to the review queue.';this.newIds();this.load();});}
  process(event:any){this.post('automation/events/'+encodeURIComponent(event.id)+'/process',{memberId:this.selected[event.id]||event.memberId||undefined},()=>{this.message='Event reviewed.';this.preview=null;this.load();});}
}
