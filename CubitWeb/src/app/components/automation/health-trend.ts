export function healthTrend(name:string,history:any){
 const start=Date.parse(history?.from),end=Date.parse(history?.to),interval=(history?.intervalSeconds||300)*1000;
 const points=(history?.points||[]).flatMap((bucket:any)=>{const check=bucket.checks.find((c:any)=>c.name===name);return check?[{...check,time:bucket.at,firstAt:bucket.firstAt,lastAt:bucket.lastAt,count:bucket.count,x:Math.max(0,Math.min(600,(Date.parse(bucket.at)-start)/(end-start)*600)),gap:bucket.gap}]:[];});
 const values=points.filter((p:any)=>typeof p.value==='number'&&Number.isFinite(p.value)).map((p:any)=>p.value);
 const numeric=values.length>0,min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):0;
 const low=min===max?Math.max(0,min-1):min,high=min===max?max+1:max;
 let previous:any;const paths:string[]=[];let path='';
 for(const p of points){p.y=typeof p.value==='number'?80-(p.value-low)/Math.max(1e-9,high-low)*64:48;
   if(typeof p.value!=='number'){if(path)paths.push(path);path='';previous=null;continue;}
   const gap=!previous||Date.parse(p.time)-Date.parse(previous.time)>interval*1.5||p.gap||previous.gap||(name==='Application'&&p.value<previous.value);
   if(gap&&path){paths.push(path);path='';}
   path+=(path?' L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2);previous=p;
 }
 if(path)paths.push(path);
 return {points,paths,numeric,min,max,width:Math.max(1,Math.min(600,interval/(end-start)*600)),unit:points.find((p:any)=>p.unit)?.unit||''};
}
