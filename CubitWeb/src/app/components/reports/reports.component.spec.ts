import {TestBed} from '@angular/core/testing';
import {provideHttpClient, withXhr} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AppModule} from '../../app.module';
import {ListNavigationService} from '../../services/list-navigation.service';
import {ReportsComponent} from './reports.component';
import {barComparison} from './bar-comparison';

describe('Check-in report views', () => {
  afterEach(() => vi.restoreAllMocks());
  it('restores unique counts and switches series without refetching or losing report state', async () => {
    const route={snapshot:{queryParams:{from:'2026-01-01',to:'2026-02-28',growth:'bars',busy:'monthDays',checkins:'unique'}}};
    const navigation={restoreScroll:vi.fn(),preservingScroll:vi.fn(action=>action())};
    await TestBed.configureTestingModule({imports:[AppModule],providers:[provideHttpClient(withXhr()),provideHttpClientTesting(),
      {provide:ActivatedRoute,useValue:route},{provide:ListNavigationService,useValue:navigation}]}).compileComponents();
    const navigate=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    const fixture=TestBed.createComponent(ReportsComponent),http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const months=[{month:'2026-01',visits:20,uniqueVisitors:8,netPayments:60,activeMembers:10},{month:'2026-02',visits:30,uniqueVisitors:6,netPayments:60,activeMembers:10}];
    http.expectOne(r=>r.url==='/api/cubit/reports').flush({from:'2026-01-01',to:'2026-02-28',summary:{checkins:50,uniqueVisitors:10},months,statuses:[]});
    fixture.detectChanges();await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.checkin-report').textContent).toContain('10 unique members');
    expect(Array.from(fixture.nativeElement.querySelectorAll('.checkin-report .chart-row b')).map((n:any)=>n.textContent.trim())).toEqual(['8','6']);
    fixture.componentInstance.comparison=barComparison(months,'uniqueVisitors',0,1);
    fixture.nativeElement.querySelector('.checkin-report .chart-toggle button').click();fixture.detectChanges();await fixture.whenStable();
    expect(fixture.componentInstance.comparison).toBeNull();
    expect(Array.from(fixture.nativeElement.querySelectorAll('.checkin-report .chart-row b')).map((n:any)=>n.textContent.trim())).toEqual(['20','30']);
    expect(navigate).toHaveBeenLastCalledWith([],expect.objectContaining({queryParams:{...route.snapshot.queryParams,checkins:'total'},replaceUrl:true}));
    expect(navigation.preservingScroll).toHaveBeenCalledOnce();http.verify();fixture.destroy();
  });
  it('compares monthly unique counts without presenting their sum as unique people', () => {
    const months=[{month:'2026-01',uniqueVisitors:8,visits:20},{month:'2026-02',uniqueVisitors:6,visits:30}];
    expect(barComparison(months,'uniqueVisitors',0,1)).toMatchObject({start:8,end:6,change:-2,percent:-25,total:null});
    expect(barComparison(months,'visits',0,1)).toMatchObject({start:20,end:30,change:10,total:50});
  });
});
