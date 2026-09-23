export function reportPeriod(months:number, today=new Date()) {
  const date=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return {from:date(new Date(today.getFullYear(),today.getMonth()-months+1,1)),to:date(today)};
}
