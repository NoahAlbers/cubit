import {describe,it,expect} from 'vitest';
import {healthTrend} from './health-trend';
describe('Health history charts',()=>{
 const history=(values:number[],offsets:number[]=values.map((_,i)=>i*5),name='Server storage')=>({from:'2026-06-27T00:00:00Z',to:'2026-09-25T01:00:00Z',intervalSeconds:300,points:values.map((value,i)=>({at:new Date(Date.parse('2026-09-25T00:00:00Z')+offsets[i]*60000).toISOString(),checks:[{name,value,status:'ok',unit:'% used'}]}))});
 it('breaks lines across missing readings',()=>{expect(healthTrend('Server storage',history([1,2,3],[0,5,20])).paths).toHaveLength(2);});
 it('shows application availability instead of an uptime line',()=>{const model=healthTrend('Application',history([4,5,0.1,0.2],undefined,'Application'));expect(model.numeric).toBe(false);expect(model.paths).toHaveLength(0);expect(model.points).toHaveLength(4);});
 it('does not fabricate historical readings',()=>{expect(healthTrend('Application',null).points).toHaveLength(0);});
 it('shows storage changes against full capacity while retaining min and max',()=>{const h:any=history([80]);h.points[0].checks[0].min=20;h.points[0].checks[0].max=80;const model=healthTrend('Server storage',h);expect(model.min).toBe(20);expect(model.max).toBe(80);expect([model.low,model.high]).toEqual([0,100]);expect(Number.isFinite(model.points[0].x)).toBe(true);});
 it('uses recorded coverage rather than stretching recent data across ninety days',()=>{const model=healthTrend('Server storage',history([30,31,32]));expect(model.from).toBe('2026-09-25T00:00:00.000Z');expect(model.to).toBe('2026-09-25T00:10:00.000Z');expect(model.points[2].x-model.points[0].x).toBeGreaterThan(550);});
 it('separates incomplete buckets',()=>{const h:any=history([1,4,5]);h.points[1].gap=true;expect(healthTrend('Server storage',h).paths).toHaveLength(3);});
});
