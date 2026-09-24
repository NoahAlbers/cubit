import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Title } from '@angular/platform-browser';

@Injectable({providedIn:'root'})
export class OrganizationService {
  name=''; supportEmail='';
  constructor(private http:HttpClient,private title:Title){}
  get contactUrl(){return 'mailto:'+this.supportEmail+'?subject=Cubit%20account%20help';}
  accept(settings:{name:string;supportEmail:string}){this.name=settings.name;this.supportEmail=settings.supportEmail;this.title.setTitle('Cubit · '+settings.name);}
  load(){this.http.get<{name:string;supportEmail:string}>('/api/organization/public').subscribe({next:d=>this.accept(d),error:()=>{this.name='';this.supportEmail='';this.title.setTitle('Cubit');}});}
}
