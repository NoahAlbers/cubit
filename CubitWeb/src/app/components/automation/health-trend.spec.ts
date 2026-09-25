import {describe,it,expect} from 'vitest';
import {healthTrend} from './health-trend';
describe('Health history charts',()=>{
 const history=(values:number[],offsets:number[]=values.map((_,i)=>i*5))=>({from:'2026-09-25T00:00:00Z',to:'2026-09-25T01:00:00Z',intervalSeconds:300,points:values.map((value,i)=>({at:new Date(Date.parse('2026-09-25T00:00:00Z')+offsets[i]*60000).toISOString(),checks:[{name:'Application',value,status:'ok',unit:'hours'}]}))});
 it('breaks lines across missing readings and restarts',()=>{
  expect(healthTrend('Application',history([1,2,3],[0,5,20])).paths).toHaveLength(2);
  expect(healthTrend('Application',history([4,5,0.1,0.2])).paths).toHaveLength(2);
 });
 it('does not fabricate historical readings',()=>{expect(healthTrend('Application',null).points).toHaveLength(0);});
 it('plots numeric values and separates incomplete buckets',()=>{
  const h:any=history([1,4,5]);h.points[1].gap=true;const model=healthTrend('Application',h);expect(model.min).toBe(1);expect(model.max).toBe(5);expect(model.paths).toHaveLength(3);
 });
});
