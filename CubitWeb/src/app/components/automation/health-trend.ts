export function healthTrend(name:string,history:any){
 const interval=(history?.intervalSeconds||300)*1000;
 const points=(history?.points||[]).flatMap((bucket:any)=>{const check=bucket.checks.find((c:any)=>c.name===name);return check?[{...check,time:bucket.firstAt||bucket.at,firstAt:bucket.firstAt||bucket.at,lastAt:bucket.lastAt||bucket.at,count:bucket.count||1,gap:bucket.gap}]:[];}).filter((p:any)=>Number.isFinite(Date.parse(p.time)));
 const start=points.length?Math.min(...points.map((p:any)=>Date.parse(p.firstAt))):0;
 const end=points.length?Math.max(...points.map((p:any)=>Date.parse(p.lastAt))):0;
 const span=Math.max(interval,end-start),single=points.length===1;
 const values=(field:string)=>points.map((p:any)=>p[field]??p.value).filter((v:any)=>typeof v==='number'&&Number.isFinite(v));
 const lows=values('min'),highs=values('max'),min=lows.length?Math.min(...lows):0,max=highs.length?Math.max(...highs):0;
 const unit=points.find((p:any)=>p.unit)?.unit||'';
 const numeric=name!=='Application'&&values('value').length>0;
 const capacity=unit.includes('%'),low=0,high=capacity?100:Math.max(unit==='ms'?100:1,Math.ceil(max*1.15));
 const y=(value:number)=>76-Math.max(0,Math.min(1,(value-low)/(high-low)))*62;
 let previous:any;const paths:string[]=[];let path='';
 for(const p of points){
   p.x=single?300:8+(Date.parse(p.time)-start)/span*584;
   p.width=single?12:Math.max(2,Math.min(600-p.x,Math.max(interval,Date.parse(p.lastAt)-Date.parse(p.firstAt))/span*584));
   p.y=y(p.value);p.lowY=y(p.min??p.value);p.highY=y(p.max??p.value);
   if(!numeric||typeof p.value!=='number'){if(path)paths.push(path);path='';previous=null;continue;}
   const gap=!previous||Date.parse(p.time)-Date.parse(previous.lastAt)>interval*1.5||p.gap||previous.gap;
   if(gap&&path){paths.push(path);path='';}
   path+=(path?' L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2);previous=p;
 }
 if(path)paths.push(path);
 return {points,paths,numeric,min,max,low,high,capacity,unit,from:points.length?new Date(start).toISOString():null,to:points.length?new Date(end).toISOString():null};
}
