import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ListNavigationService } from '../../services/list-navigation.service';
import { reportPeriod } from './report-period';
import { membershipChart } from './membership-chart';
import { barComparison, ComparisonField } from './bar-comparison';
@Component({selector:'app-reports',templateUrl:'./reports.component.html'})
export class ReportsComponent implements OnInit, OnDestroy {
  private request?:Subscription;
  ngOnDestroy(){this.request?.unsubscribe();this.clearComparison();}
  from='';to='';data:any;loading=false;error='';downloading='';
  periods=[{months:1,label:'1 month'},{months:3,label:'3 months'},{months:6,label:'6 months'},{months:12,label:'1 year'},{months:24,label:'2 years'}];
  private restorePosition=true;
  growthView='line'; busyView='weekHours'; chart=membershipChart([]);
  heatRows:any[]=[];heatColumns:number[]=[];heatMax=0;heatDetail='';heatHover='';activePoint:any=null;
  comparison:ReturnType<typeof barComparison>=null;
  comparisonX=0;comparisonY=0;
  private drag:{field:ComparisonField;anchor:number;pointer:number;target:HTMLElement;rows:HTMLElement[];moved:boolean}|null=null;
  private ignoreDragClick=false;
  private clickReset:any;
  get partialComparison(){if(!this.comparison||!this.data)return false;const end=new Date(this.data.to+'T00:00:00Z');const monthEnd=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate();return (this.comparison.first===0&&this.data.from.slice(8)!=='01')||(this.comparison.last===this.data.months.length-1&&end.getUTCDate()!==monthEnd);}
  comparisonLabel(field:ComparisonField){return {activeMembers:'Active members',netPayments:'Payments',visits:'Successful check-ins'}[field];}
  comparisonValue(value:number,field:ComparisonField){return field==='netPayments'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value):value.toLocaleString('en-US');}
  selectedRow(field:ComparisonField,index:number){return this.comparison?.field===field&&index>=this.comparison.first&&index<=this.comparison.last;}
  private placeComparison(x:number,y:number){this.comparisonX=Math.max(8,Math.min(window.innerWidth-292,x+16));this.comparisonY=Math.max(8,Math.min(window.innerHeight-260,y+16));}
  private chartRows(field:ComparisonField){return Array.from(document.querySelectorAll<HTMLElement>('.report-bar-list [data-series="'+field+'"]'));}
  startComparison(event:PointerEvent,field:ComparisonField,index:number){
    if(event.button!==0||!event.isPrimary)return;
    this.clearComparison();
    const target=event.currentTarget as HTMLElement;
    this.drag={field,anchor:index,pointer:event.pointerId,target,rows:this.chartRows(field),moved:false};
    target.setPointerCapture(event.pointerId);target.focus({preventScroll:true});event.preventDefault();
  }
  @HostListener('document:pointerdown') outsidePointerDown(){this.ignoreDragClick=false;this.comparison=null;}
  @HostListener('document:pointermove',['$event']) moveComparison(event:PointerEvent){
    const drag=this.drag;if(!drag||event.pointerId!==drag.pointer)return;
    let index=0,distance=Infinity;
    drag.rows.forEach((row,i)=>{const rect=row.getBoundingClientRect(),d=Math.abs(event.clientY-(rect.top+rect.height/2));if(d<distance){index=i;distance=d;}});
    if(index!==drag.anchor)drag.moved=true;
    if(drag.moved){this.comparison=barComparison(this.data.months,drag.field,drag.anchor,index);this.placeComparison(event.clientX,event.clientY);}
    event.preventDefault();
  }
  @HostListener('document:pointerup',['$event']) finishComparison(event:PointerEvent){
    if(!this.drag||event.pointerId!==this.drag.pointer)return;
    const drag=this.drag;this.drag=null;
    if(drag.target.hasPointerCapture(event.pointerId))drag.target.releasePointerCapture(event.pointerId);
    if(drag.moved){this.ignoreDragClick=true;this.clickReset=setTimeout(()=>this.ignoreDragClick=false,0);}else this.comparison=null;
  }
  @HostListener('document:click') dismissComparison(){if(this.ignoreDragClick){this.ignoreDragClick=false;return;}this.clearComparison();}
  @HostListener('document:pointercancel') @HostListener('window:blur') clearComparison(){
    const drag=this.drag;this.drag=null;this.comparison=null;this.ignoreDragClick=false;clearTimeout(this.clickReset);
    if(drag?.target.hasPointerCapture(drag.pointer))drag.target.releasePointerCapture(drag.pointer);
  }
  @HostListener('document:keydown.escape') escapeComparison(){this.clearComparison();}
  compareWithKeyboard(event:KeyboardEvent,field:ComparisonField,index:number){
    if(!event.shiftKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const end=Math.max(0,Math.min(this.data.months.length-1,index+(event.key==='ArrowDown'?1:-1)));
    const anchor=this.comparison?.field===field?(this.comparison.first===index?this.comparison.last:this.comparison.first):index;
    this.comparison=barComparison(this.data.months,field,anchor,end);
    const row=this.chartRows(field)[end];row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});
    const rect=row.getBoundingClientRect();this.placeComparison(rect.right-280,rect.bottom);
  }
  remember(){return this.router.navigate([],{relativeTo:this.route,queryParams:{from:this.data?.from||this.from,to:this.data?.to||this.to,growth:this.growthView,busy:this.busyView},replaceUrl:true});}
  pointTooltip(point:any){return 'translate('+Math.max(52,Math.min(426,point.x-77))+','+(point.y<100?point.y+16:point.y-58)+')';}
  setGrowth(view:string){this.clearComparison();this.activePoint=null;this.growthView=view;this.navigation.preservingScroll(()=>this.remember());}
  setBusy(){this.prepareHeat();this.navigation.preservingScroll(()=>this.remember());}
  prepareHeat(){this.heatRows=this.data?.busiestTimes?.[this.busyView]||[];this.heatColumns=Array.from({length:this.busyView==='weekHours'?24:31},(_,i)=>i);this.heatMax=this.heatRows.reduce((max,row)=>Math.max(max,...row.values.map(v=>v||0)),0);this.heatDetail='';this.heatHover='';this.activePoint=null;}
  heatColor(value:number|null){if(value===null)return '';if(!value||!this.heatMax)return '#edf2f8';return ['#dceafa','#a6c9f1','#5c99dd','#216cbf','#094fa3'][Math.min(4,Math.ceil(value/this.heatMax*5)-1)];}
  heatText(value:number){return this.heatMax&&value/this.heatMax>0.4?'#ffffff':'#153653';}
  hourLabel(hour:number){const h=hour%24;return h===0?'Midnight':(h%12||12)+(h<12?'am':'pm');}
  cellLabel(row:any,col:number){
    if(this.busyView==='weekHours')return row.label+' '+this.hourLabel(col)+'–'+this.hourLabel(col+1)+' · '+row.values[col]+' successful check-ins';
    return row.label+' '+(col+1)+' · '+new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(row.values[col])+' average check-ins · '+row.totals[col]+' entries across '+row.samples[col]+' included date'+(row.samples[col]===1?'':'s');
  }
  monthLabel(month:string){return new Date(month+'-01T00:00:00Z').toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'});}
  monthScope(month:string){
    if(!this.data)return '';
    const start=month+'-01',last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
    if(this.data.from>start||this.data.to<last)return 'Partial month';
    return '';
  }
  exportJump(){document.getElementById('report-exports')?.scrollIntoView({block:'start'});document.getElementById('report-exports')?.focus({preventScroll:true});}

  exports=[{id:'roster',name:'Member roster',detail:'Current status, contact details and plans'},
    {id:'transactions',name:'Transactions',detail:'Payments, refunds and correction entries in the selected period'},
    {id:'overdue',name:'Overdue memberships',detail:'Current ongoing memberships with past-due charges'},
    {id:'checkins',name:'Check-ins',detail:'Successful and denied entries in the selected period'}];
  constructor(private http:HttpClient, private route:ActivatedRoute, private router:Router, public navigation:ListNavigationService){}
  ngOnInit(){const period=reportPeriod(3),q=this.route.snapshot.queryParams;this.from=q.from||period.from;this.to=q.to||period.to;this.growthView=q.growth==='bars'?'bars':'line';this.busyView=q.busy==='monthDays'?'monthDays':'weekHours';this.load();}
  choosePeriod(months:number){Object.assign(this,reportPeriod(months));this.load();}
  isPeriod(months:number){const p=reportPeriod(months);return this.from===p.from&&this.to===p.to;}
  date(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  load(){this.clearComparison();this.request?.unsubscribe();this.loading=true;this.error='';this.request=this.http.get<any>('/api/cubit/reports',{params:{from:this.from,to:this.to}}).subscribe({next:d=>{this.data=d;this.chart=membershipChart(d.months);this.prepareHeat();this.loading=false;this.remember().then(()=>{if(this.restorePosition){this.restorePosition=false;this.navigation.restoreScroll();}});},error:e=>{this.loading=false;this.error=e.error?.message||'Could not load reports.';}});}
  width(value:number,field:string){const max=Math.max(1,...this.data.months.map(m=>Math.abs(m[field])));return Math.abs(value)/max*100;}
  export(type:string){if(this.downloading)return;this.downloading=type;this.error='';
    this.http.get('/api/cubit/reports/'+type+'.csv',{params:{from:this.data.from,to:this.data.to},responseType:'blob'}).subscribe({next:blob=>{
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`cubit-${type}-${this.data.asOf}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.downloading='';
    },error:()=>{this.downloading='';this.error='Could not export the report. Please retry.';}});
  }
}
