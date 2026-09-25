import {describe,it,expect} from 'vitest';
import {organizationDay,offsetAt,setOrganizationTimeZone} from './org-time';
import {OrgDatePipe} from './org-date.pipe';
describe('Organization date formatting',()=>{
  it('uses the chosen zone and DST while preserving date-only billing days',()=>{
    const org:any={timezone:'America/New_York'},pipe=new OrgDatePipe(org);
    expect(organizationDay(new Date('2026-07-01T02:00Z'))).toBe('2026-06-30');
    expect(offsetAt(new Date('2026-01-01T12:00Z'),org.timezone)).toBe('-0500');
    expect(offsetAt(new Date('2026-07-01T12:00Z'),org.timezone)).toBe('-0400');
    expect(pipe.transform('2026-07-01','MMM d, y')).toBe('Jul 1, 2026');
    expect(pipe.transform('2026-07-01T02:00Z','MMM d, y')).toBe('Jun 30, 2026');
    org.timezone='Asia/Tokyo';expect(pipe.transform('2026-07-01T02:00Z','MMM d, y')).toBe('Jul 1, 2026');
    setOrganizationTimeZone('America/New_York');
  });
});
