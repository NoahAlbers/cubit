import { organizationDay } from '../../services/org-time';
export function reportPeriod(months:number, today=new Date()) {
  const to=organizationDay(today);const [year,month]=to.split('-').map(Number);
  return {from:new Date(Date.UTC(year,month-months,1)).toISOString().slice(0,10),to};
}
