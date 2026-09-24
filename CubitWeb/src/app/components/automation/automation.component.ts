import { Component, OnInit } from '@angular/core';
import { ListNavigationService } from '../../services/list-navigation.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
@Component({selector:'app-automation',templateUrl:'./automation.component.html'})
export class AutomationComponent implements OnInit {
  data:any; settings:any; error='';message='';busy=false;preview:any;
  graceEnabled=true; graceDays=60;
  constructor(private http:HttpClient, public navigation:ListNavigationService, private route:ActivatedRoute, private router:Router){}
  ngOnInit(){this.load();}
  scrollToSection(){const fragment=this.route.snapshot.fragment;if(fragment)requestAnimationFrame(()=>document.getElementById(fragment)?.scrollIntoView());}
  load(){this.http.get<any>('/api/cubit/automation').subscribe({next:d=>{this.data=d;this.settings={...d.settings};this.graceEnabled=d.settings.graceDays>0;if(this.graceEnabled)this.graceDays=d.settings.graceDays;const fragment=this.route.snapshot.fragment;if(fragment)requestAnimationFrame(()=>document.getElementById(fragment)?.scrollIntoView());},error:e=>this.error=e.error?.message||'Could not load automation.'});}
  post(path:string,body:any,done:(r:any)=>void){if(this.busy)return;this.busy=true;this.error='';this.message='';this.http.post<any>('/api/cubit/'+path,body).subscribe({next:r=>{this.busy=false;done(r);},error:e=>{this.busy=false;this.error=e.error?.message||'Could not complete the action.';}});}
  save(){this.post('automation/settings',{...this.settings,graceDays:this.graceEnabled?this.graceDays:0},()=>{this.preview=null;this.message='Settings saved. Grace changes apply to access eligibility immediately.';this.load();});}
  run(isPreview:boolean){this.post('automation/run',{preview:isPreview},r=>{this.preview=r;if(!isPreview){this.message='Billing and access processing completed.';this.preview=null;this.load();}});}
}
