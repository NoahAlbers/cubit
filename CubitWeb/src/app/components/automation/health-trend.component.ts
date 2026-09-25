import { Component,Input,OnChanges,ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrgDatePipe } from '../../services/org-date.pipe';
import { healthTrend } from './health-trend';
@Component({selector:'app-health-trend',standalone:true,imports:[CommonModule,OrgDatePipe],changeDetection:ChangeDetectionStrategy.Eager,
template:`@if(model.points.length){<div class="trend-meta"><span>{{model.numeric?'Recorded range: '+number(model.min)+'–'+number(model.max)+' '+model.unit:'Status history'}}</span><span>{{history.intervalSeconds>300?'Summarized peaks / worst status':'5-minute samples'}}</span></div>
<svg viewBox="0 0 600 100" preserveAspectRatio="none" role="img" tabindex="0" [attr.aria-label]="name+' history. Use left and right arrow keys to inspect recorded readings.'" (pointermove)="hover($event)" (pointerleave)="active=null" (focus)="select(model.points.length-1)" (blur)="active=null" (keydown)="key($event)">
<path d="M0,86H600" stroke="#dce5ef" stroke-width="1" fill="none"/>
@if(model.numeric){@for(path of model.paths;track $index){<path [attr.d]="path" fill="none" stroke="#094fa3" stroke-width="2" vector-effect="non-scaling-stroke"/>}
@for(p of model.points;track p.time){@if(p.value!==undefined){<circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.5" [attr.fill]="color(p.status)"/>}@else{<rect [attr.x]="p.x" y="84" [attr.width]="model.width" height="5" fill="#bac4d0"/>}}}
@else{@for(p of model.points;track p.time){<rect [attr.x]="p.x" y="30" [attr.width]="model.width" height="35" rx="1" [attr.fill]="color(p.status)" [attr.opacity]="p.gap?0.45:1"/>}}
@if(active){<path [attr.d]="'M'+active.x+',8V88'" stroke="#425d7b" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>}
</svg><div class="trend-dates"><span>{{history.from|orgDate:'MMM d, h:mm a'}}</span><span>{{history.to|orgDate:'MMM d, h:mm a'}}</span></div>
<div class="reading" aria-live="polite">@if(active){<strong>{{active.firstAt|orgDate:'MMM d, h:mm a'}}–{{active.lastAt|orgDate:'h:mm a'}} · {{active.status==='ok'?'Healthy':active.status==='unknown'?'Unavailable':active.status==='warning'?'Needs attention':'Critical'}}</strong><span>@if(active.value!==undefined){Peak {{number(active.value)}} {{model.unit}} · }{{active.count}} recorded sample{{active.count===1?'':'s'}}@if(active.gap){ · Incomplete coverage}</span><span>{{active.detail}} (Observed {{active.at|orgDate:'MMM d, h:mm a'}})</span>}@else{<span class="muted">Hover or focus the chart to inspect readings.</span>}</div>
} @else{<p class="muted trend-empty">History is collecting. The first reading appears after the sampler runs; older readings are not invented.</p>}`,
styles:[`:host{display:block;margin-top:18px}.trend-meta,.trend-dates{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#526780;flex-wrap:wrap}svg{display:block;width:100%;height:84px;margin-top:6px;border-radius:4px}svg:focus-visible{outline:2px solid #094fa3;outline-offset:4px}.reading{font-size:12px;line-height:1.45;min-height:74px;margin-top:10px;display:grid;align-content:start;gap:2px;overflow-wrap:anywhere}.trend-empty{font-size:12px;margin:18px 0 0}`]})
export class HealthTrendComponent implements OnChanges {
 @Input() name='';@Input() history:any;model=healthTrend('',null);active:any=null;index=0;
 ngOnChanges(){this.model=healthTrend(this.name,this.history);this.active=null;}
 color(status:string){return {ok:'#387b58',warning:'#cc971b',critical:'#d3313b',unknown:'#bac4d0'}[status]||'#bac4d0';}
 number(value:number){return value.toLocaleString('en-US',{maximumFractionDigits:2});}
 select(index:number){this.index=Math.max(0,Math.min(this.model.points.length-1,index));this.active=this.model.points[this.index]||null;}
 hover(event:PointerEvent){const rect=(event.currentTarget as SVGElement).getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*600;let best=0;this.model.points.forEach((p:any,i:number)=>{if(Math.abs(p.x-x)<Math.abs(this.model.points[best].x-x))best=i;});this.select(best);}
 key(event:KeyboardEvent){if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();this.select(event.key==='Home'?0:event.key==='End'?this.model.points.length-1:this.index+(event.key==='ArrowLeft'?-1:1));}}
}
