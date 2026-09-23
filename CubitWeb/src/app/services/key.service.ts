import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { MemberPlan } from '../entities/memberPlan';
import { Plan } from '../entities/plan';
import { Key } from '../entities/memberKey';

@Injectable()
export class KeyService {
  constructor(private http: HttpClient) {}

  getMemberActivity(memberId: string): Observable<{lastEntry: string | null; keys: Key[]}> {
    return this.http.get<{lastEntry: string | null; keys: Key[]}>(
      environment.apiUrl + `key/memberActivity/${memberId}`
    );
  }

  getMemberKeyList(memberId): Observable<Key[]> {
    return this.http.get<Key[]>(
      environment.apiUrl + `key/memberKeys/${memberId}`
    );
  }

  saveKey(key: Key): Promise<any> {
    console.log('saving key to web service', key);
    return this.http.post(environment.apiUrl + 'key', key).toPromise();
  }

  deleteKey(key: Key): Promise<any> {
    return this.http
      .delete(environment.apiUrl + `key/${key.id}`)
      .toPromise();
  }
}
