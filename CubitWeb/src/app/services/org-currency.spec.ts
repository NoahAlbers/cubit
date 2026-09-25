import {describe,it,expect} from 'vitest';
import {formatMoney,OrgCurrencyPipe} from './org-currency.pipe';
describe('Organization currency',()=>{
 it('changes symbols without converting or hiding stored cents',()=>{
  expect(formatMoney(12.34,'USD')).toBe('$12.34');expect(formatMoney(12.34,'EUR')).toBe('€12.34');
  expect(formatMoney(12.34,'JPY')).toContain('12.34');
  const org:any={currency:'USD'},pipe=new OrgCurrencyPipe(org);expect(pipe.transform(-10)).toBe('-$10.00');org.currency='GBP';expect(pipe.transform(-10)).toBe('-£10.00');expect(pipe.transform(null)).toBeNull();
 });
});
