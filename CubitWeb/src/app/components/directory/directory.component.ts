import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, of, timer } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ListNavigationService } from '../../services/list-navigation.service';

@Component({
    selector: 'app-directory', templateUrl: './directory.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DirectoryComponent implements OnInit, OnDestroy {
  overdue = false; loading = true; error = ''; data: any; plans: any[] = [];
  filters: any = { q: '', field: 'all', status: '', plan: '', activity: '', sort: 'name', order: 'asc', minDays: '', access: '', includeEnded: false, page: 1, pageSize: 20 };
  filtersOpen=false;
  get activeFilters(){return [this.filters.status,this.filters.plan,this.filters.activity,this.filters.access,this.filters.minDays,this.filters.includeEnded].filter(Boolean).length;}
  pageSizes = [10,20,50,100];
  private changes = new Subject<void>(); private subscription = new Subscription();
  private restorePosition = true;
  constructor(private http: HttpClient, private route: ActivatedRoute, private router: Router, public navigation: ListNavigationService) {}
  ngOnInit() {
    this.overdue = this.route.snapshot.data.overdue === true;
    this.filters.sort = this.overdue ? 'oldest' : 'name';
    this.filters.order = this.overdue ? 'desc' : 'asc';
    for (const key of Object.keys(this.filters)) {
      if (this.route.snapshot.queryParams[key] !== undefined) this.filters[key] = this.route.snapshot.queryParams[key];
    }
    this.filters.includeEnded = this.filters.includeEnded === 'true' || this.filters.status === 'Canceled';
    this.filters.pageSize = this.pageSizes.includes(Number(this.filters.pageSize)) ? Number(this.filters.pageSize) : 20;
    this.filters.page = Math.max(1,Math.floor(Number(this.filters.page)) || 1);
    if (!this.route.snapshot.queryParams.order) this.filters.order = this.defaultOrder(this.filters.sort);
    this.http.get<any[]>('/plan').subscribe({ next: plans => this.plans = plans, error: () => this.error = 'Could not load plans.' });
    this.subscription.add(this.changes.pipe(switchMap(() => timer(200).pipe(switchMap(() => {
      this.loading = true; this.error = '';
      const params: any = { ...this.filters, overdue: String(this.overdue) };
      return this.http.get<any>('/api/cubit/members', { params }).pipe(catchError(err => {
        this.error = err.error?.message || 'Could not load members. Please retry.'; return of(null);
      }));
    })))).subscribe(result => { this.loading = false; if (result) {
      this.data = result; this.filters.page = result.page; this.filters.pageSize = result.pageSize;
      this.filters.sort=result.sort; this.filters.order=result.order;
      this.router.navigate([], { relativeTo: this.route, queryParams: this.filters, replaceUrl: true }).then(()=>{
        if(this.restorePosition){this.restorePosition=false;this.navigation.restoreScroll();}
      });
    } }));
    this.changes.next();
  }
  apply() {
    if (this.filters.status === 'Canceled') this.filters.includeEnded = true;
    this.filters.page = 1; this.loading = true; this.changes.next();
  }
  toggleEnded() {
    if (!this.filters.includeEnded && this.filters.status === 'Canceled') this.filters.status = '';
    this.apply();
  }
  defaultOrder(column: string) { return ['balance','amount','oldest','recent','access'].includes(column) ? 'desc' : 'asc'; }
  sortBy(column: string) {
    this.filters.order=this.filters.sort===column ? (this.filters.order==='asc'?'desc':'asc') : this.defaultOrder(column);
    this.filters.sort=column; this.apply();
  }
  sortChanged() { this.filters.order=this.defaultOrder(this.filters.sort); this.apply(); }
  sortIcon(column: string) { return this.filters.sort===column ? (this.filters.order==='asc'?'sort-ascending':'sort-descending') : 'sort'; }
  ariaSort(...columns: string[]) { return columns.includes(this.filters.sort) ? (this.filters.order==='asc'?'ascending':'descending') : 'none'; }
  goToPage(page: number) {
    if(this.loading || !this.data || page===this.data.page || page<1 || page>this.data.pages)return;
    this.filters.page=page; this.loading=true; this.changes.next();
  }
  get pageNumbers(): number[] {
    if(!this.data)return [];
    const first=Math.max(1,this.data.page-4),last=Math.min(this.data.pages,this.data.page+4);
    return Array.from({length:last-first+1},(_,i)=>first+i);
  }
  get firstRow() { return this.data?.total ? (this.data.page-1)*this.data.pageSize+1 : 0; }
  get lastRow() { return this.data ? Math.min(this.data.page*this.data.pageSize,this.data.total) : 0; }
  reset() {
    this.filters = { q: '', field: 'all', status: '', plan: '', activity: '', sort: this.overdue ? 'oldest' : 'name', order: this.overdue?'desc':'asc', minDays: '', access: '', includeEnded: false, page: 1, pageSize: this.filters.pageSize };
    this.loading=true;
    this.changes.next();
  }
  openMember(event: MouseEvent, member: any) {
    if ((event.target as HTMLElement).closest('a,button,input,select') || window.getSelection()?.toString()) return;
    const url = this.router.serializeUrl(this.router.createUrlTree(['/member', member.id], {queryParams:this.navigation.memberQuery}));
    if (event.ctrlKey || event.metaKey) window.open(url, '_blank', 'noopener');
    else this.router.navigateByUrl(url);
  }
  ngOnDestroy() { this.subscription.unsubscribe(); }
}
