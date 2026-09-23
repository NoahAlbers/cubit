import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class AccessLogService {
  constructor(private http: HttpClient) {}

  getAccessLog(params:any): Observable<{rows:any[];total:number;page:number;pages:number}> {
    return this.http.get<{rows:any[];total:number;page:number;pages:number}>(
      environment.TonicAPIURL + 'accessLog/events', {params});
  }
}
