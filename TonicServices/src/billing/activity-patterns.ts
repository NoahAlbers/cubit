export const activityTimeZone = 'America/New_York'
const calendar = new Intl.DateTimeFormat('en-US', { timeZone: activityTimeZone, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short', hour:'2-digit', hourCycle:'h23' })
const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export function localAccessEntries(logs:any[], from:string, to:string, now = new Date()) {
  const earliest=Date.parse(from+'T00:00:00Z')-86400000, latest=Math.min(+now,Date.parse(to+'T00:00:00Z')+2*86400000)
  return logs.flatMap(event=>{
    const stamp=new Date(event.timestamp)
    if(!Number.isFinite(+stamp)||+stamp<earliest||+stamp>latest||+stamp>+now)return []
    const p=Object.fromEntries(calendar.formatToParts(stamp).map(part=>[part.type,part.value]))
    const date=`${p.year}-${p.month}-${p.day}`
    return date>=from&&date<=to ? [{event,date,hour:Number(p.hour),weekday:weekdays.indexOf(p.weekday)}] : []
  })
}

export function busiestTimes(entries:ReturnType<typeof localAccessEntries>, from:string, to:string) {
  const weekHours=weekdays.map(label=>({label,values:Array<number>(24).fill(0)}))
  const monthDays:{label:string,values:(number|null)[]}[]=[]
  for(let d=new Date(from.slice(0,7)+'-01T00:00:00Z');d.toISOString().slice(0,10)<=to;d.setUTCMonth(d.getUTCMonth()+1)){
    const month=d.toISOString().slice(0,7),last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()
    monthDays.push({label:month,values:Array.from({length:31},(_,i)=>{
      const date=month+'-'+String(i+1).padStart(2,'0')
      return i<last&&date>=from&&date<=to?0:null
    })})
  }
  const months=new Map(monthDays.map(row=>[row.label,row]))
  let total=0
  for(const entry of entries){
    if(!entry.event.accessGranted)continue
    weekHours[entry.weekday].values[entry.hour]++
    months.get(entry.date.slice(0,7))!.values[Number(entry.date.slice(8,10))-1]!++
    total++
  }
  return {timeZone:activityTimeZone,total,weekHours,monthDays}
}
