export type ComparisonField = 'activeMembers' | 'netPayments' | 'visits';

export function barComparison(months:any[], field:ComparisonField, anchor:number, end:number) {
  if(!months.length)return null;
  const first=Math.max(0,Math.min(anchor,end)),last=Math.min(months.length-1,Math.max(anchor,end));
  const scale=field==='netPayments'?100:1;
  const value=(m:any)=>Math.round(Number(m[field])*scale);
  const startValue=value(months[first]),endValue=value(months[last]),change=endValue-startValue;
  return {field,first,last,from:months[first].month,to:months[last].month,
    start:startValue/scale,end:endValue/scale,change:change/scale,
    percent:startValue>0?change/startValue*100:startValue===0&&endValue===0?0:null,
    total:field==='activeMembers'?null:months.slice(first,last+1).reduce((sum,m)=>sum+value(m),0)/scale,
    estimated:field==='activeMembers'&&months.slice(first,last+1).some(m=>m.membershipEstimated)};
}
