export let organizationTimeZone = 'America/New_York';
export function setOrganizationTimeZone(zone:string){organizationTimeZone=zone;}
export function organizationDay(date=new Date(),zone=organizationTimeZone){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}
export function calendarDay(value:string|Date){return typeof value==='string'?value.slice(0,10):value.toISOString().slice(0,10);}
export function offsetAt(date:Date,zone:string){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  const minutes=Math.round((Date.UTC(+p['year'],+p['month']-1,+p['day'],+p['hour'],+p['minute'],+p['second'])-Math.floor(+date/1000)*1000)/60000);
  return `${minutes<0?'-':'+'}${String(Math.floor(Math.abs(minutes)/60)).padStart(2,'0')}${String(Math.abs(minutes)%60).padStart(2,'0')}`;
}
