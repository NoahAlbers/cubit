export function membershipChart(months:any[]) {
  const values=months.map(m=>Number(m.activeMembers)||0)
  const minimum=values.length?Math.min(...values):0,maximum=values.length?Math.max(...values):0
  // Keep a nonzero span for a flat series or a single month.
  const step=Math.max(1,Math.ceil((maximum-minimum)/4)),span=step*4
  const points=months.map((m,i)=>({...m,x:months.length===1?316:52+i*528/(months.length-1),y:224-184*(Number(m.activeMembers)-minimum)/span}))
  return {minimum,points,path:points.map(p=>`${p.x},${p.y}`).join(' '),
    ticks:Array.from({length:5},(_,i)=>({value:minimum+i*step,y:224-i*46})),
    labels:points.filter((p,i)=>i===0||i===points.length-1||i%Math.max(1,Math.ceil(points.length/5))===0)};
}
