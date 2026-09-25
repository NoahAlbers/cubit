import { setOrganizationTimeZone } from './org-time';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';

@Injectable({providedIn:'root'})
export class OrganizationService {
  name=''; supportEmail=''; timezone='America/New_York';
  constructor(private http:HttpClient,private title:Title){}
  acceptTimezone(zone:string){try{new Intl.DateTimeFormat('en-US',{timeZone:zone});this.timezone=zone;setOrganizationTimeZone(zone);}catch{}}
  get contactUrl(){return 'mailto:'+this.supportEmail+'?subject=Cubit%20account%20help';}
  accept(settings:{name:string;supportEmail:string;timezone?:string}){this.timezone=settings.timezone||'America/New_York';setOrganizationTimeZone(this.timezone);this.name=settings.name;this.supportEmail=settings.supportEmail;this.title.setTitle('Cubit · '+settings.name);}
  load(){this.http.get<{name:string;supportEmail:string;timezone?:string}>('/api/organization/public').subscribe({next:d=>this.accept(d),error:()=>{this.name='';this.supportEmail='';this.title.setTitle('Cubit');}});}
}
