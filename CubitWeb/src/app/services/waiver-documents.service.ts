import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
@Injectable({providedIn:'root'})
export class WaiverDocumentsService {
  constructor(private http:HttpClient){}
  upload(url:string,file:File){return this.http.post<any>(url,file,{headers:{'Content-Type':'application/octet-stream','X-Cubit-Filename':file.name.replace(/[^\x20-\x7e]/g,'_')}}).toPromise();}
  async download(document:any,staff=false){
    const blob=await this.http.get((staff?'/api/waivers':'/api/portal')+'/documents/'+document.id,{responseType:'blob'}).toPromise();
    const url=URL.createObjectURL(blob),a=window.document.createElement('a');a.href=url;a.download=document.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
