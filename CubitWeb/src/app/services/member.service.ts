import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { take, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Member } from '../entities/member';
import { MemberPlan } from '../entities/memberPlan';

@Injectable()
export class MemberService {
  constructor(private http: HttpClient) {}

  getMemberList(): Observable<Member[]> {
    return this.http.get<{rows:Member[]}>(environment.apiUrl + 'api/cubit/members?pageSize=100').pipe(map(result=>result.rows));
  }

  getMemberPlans(memberKey): Observable<MemberPlan[]> {
    return this.http.get<MemberPlan[]>(
      environment.apiUrl + 'member/plans/' + memberKey
    );
  }

  isMemberActive(memberKey): Observable<boolean> {
    return this.http.get<boolean>(
      environment.apiUrl + 'member/isActive/' + memberKey
    );
  }

  getPlan(Id): Observable<MemberPlan> {
    return this.http.get<MemberPlan>(environment.apiUrl + 'plan/' + Id);
  }

  savePlan(plan: {id: string; memberId: string; planId: string; startDate: string; catalogRevision?: number}): Promise<any> {
    //console.log('saving plan', plan);
    return this.http
      .post(environment.apiUrl + 'plan/memberplan', plan)
      .toPromise();
  }

  getMember(id): Observable<Member> {
    //console.log('getting: ', `Members/${id}`);
    return this.http.get<Member>(environment.apiUrl + `member/` + id);
  }

  getMemberBalance(id): Observable<number> {
    return this.http.get<number>(
      environment.apiUrl + `member/balance/` + id
    );
  }

  saveMember(member: Member): Observable<any> {


    if (member.id == 'New') {
      return this.http.post<Member>(environment.apiUrl + 'member', member);
    } else {
      return this.http.put<Member>(environment.apiUrl + 'member', member);
    }
  }

}
