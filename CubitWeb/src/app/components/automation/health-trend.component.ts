import { Component,Input,OnChanges,ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrgDatePipe } from '../../services/org-date.pipe';
import { healthTrend } from './health-trend';
@Component({selector:'app-health-trend',standalone:true,imports:[CommonModule,OrgDatePipe],changeDetection:ChangeDetectionStrategy.Eager,
template:`@if(model.points.length){<div class="trend-meta"><span>{{model.numeric?'Min–max: '+number(model.min)+'–'+number(model.max)+' '+model.unit:'Recorded availability'}}</span><span>{{model.numeric?'Scale '+number(model.low)+'–'+number(model.high)+(model.capacity?'%':' '+model.unit):'Gaps = no reading'}}</span></div>
<svg viewBox="0 0 600 100" preserveAspectRatio="none" role="img" tabindex="0" [attr.aria-label]="name+' history. Use left and right arrow keys to inspect recorded readings.'" (pointermove)="hover($event)" (pointerleave)="active=null" (focus)="select(model.points.length-1)" (blur)="active=null" (keydown)="key($event)">
<path d="M0,86H600" stroke="#dce5ef" stroke-width="1" fill="none"/>
@if(model.numeric){@for(path of model.paths;track $index){<path [attr.d]="path" fill="none" stroke="#094fa3" stroke-width="2" vector-effect="non-scaling-stroke"/>}
@for(p of model.points;track p.time){@if(p.value!==undefined){<path [attr.d]="'M'+p.x+','+p.lowY+'V'+p.highY" stroke="#8faed0" stroke-width="3" vector-effect="non-scaling-stroke"/><circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.5" [attr.fill]="color(p.status)"/>}@else{<rect [attr.x]="p.x" y="84" [attr.width]="p.width" height="5" fill="#bac4d0"/>}}}
@else{@for(p of model.points;track p.time){<rect [attr.x]="p.x" y="30" [attr.width]="p.width" height="35" rx="1" [attr.fill]="color(p.status)" [attr.opacity]="p.gap?0.45:1"/>}}
@if(active){<path [attr.d]="'M'+active.x+',8V88'" stroke="#425d7b" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>}
</svg><div class="trend-dates"><span>{{model.from|orgDate:'MMM d, h:mm a'}}</span><span>{{model.to|orgDate:'MMM d, h:mm a'}}</span></div>
@if(active){<div class="reading" aria-live="polite"><strong>{{active.firstAt|orgDate:'MMM d, h:mm a'}}–{{active.lastAt|orgDate:'h:mm a'}} · {{active.status==='ok'?'Healthy':active.status==='unknown'?'Unavailable':active.status==='warning'?'Needs attention':'Critical'}}</strong><span>@if(model.numeric&&active.value!==undefined){Min–max {{number(active.min??active.value)}}–{{number(active.max??active.value)}} {{model.unit}} · }{{active.count}} sample{{active.count===1?'':'s'}}@if(active.gap){ · Incomplete coverage}</span><span>{{active.detail}}</span></div>}
} @else{<p class="muted trend-empty">History is collecting. The first reading appears after the sampler runs; older readings are not invented.</p>}`,
styles:[`:host{display:block;position:relative;margin-top:10px}.trend-meta,.trend-dates{display:flex;justify-content:space-between;gap:6px;font-size:10px;color:#526780;flex-wrap:wrap}svg{display:block;width:100%;height:44px;margin-top:4px;border-radius:4px}svg:focus-visible{outline:2px solid #094fa3;outline-offset:4px}.reading{position:absolute;bottom:58px;left:0;right:0;z-index:3;background:#fff;border:1px solid #bacbdd;box-shadow:0 4px 16px #18324d22;border-radius:6px;padding:10px;font-size:12px;line-height:1.45;display:grid;gap:3px;overflow-wrap:anywhere;pointer-events:none}.trend-empty{font-size:12px;margin:10px 0 0}`]})
export class HealthTrendComponent implements OnChanges {
 @Input() name='';@Input() history:any;model=healthTrend('',null);active:any=null;index=0;
 ngOnChanges(){this.model=healthTrend(this.name,this.history);this.active=null;}
 color(status:string){return {ok:'#387b58',warning:'#cc971b',critical:'#d3313b',unknown:'#bac4d0'}[status]||'#bac4d0';}
 number(value:number){return value.toLocaleString('en-US',{maximumFractionDigits:2});}
 select(index:number){this.index=Math.max(0,Math.min(this.model.points.length-1,index));this.active=this.model.points[this.index]||null;}
 hover(event:PointerEvent){const rect=(event.currentTarget as SVGElement).getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width*600;let best=0;this.model.points.forEach((p:any,i:number)=>{if(Math.abs(p.x-x)<Math.abs(this.model.points[best].x-x))best=i;});this.select(best);}
 key(event:KeyboardEvent){if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();this.select(event.key==='Home'?0:event.key==='End'?this.model.points.length-1:this.index+(event.key==='ArrowLeft'?-1:1));}}
}
