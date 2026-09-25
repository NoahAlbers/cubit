import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';
import { OrganizationService } from './organization.service';
import { offsetAt } from './org-time';
@Pipe({name:'orgDate',standalone:true,pure:false})
export class OrgDatePipe implements PipeTransform {
  constructor(private organization:OrganizationService){}
  transform(value:any,format='mediumDate',calendar?:string):string|null {
    if(value===null||value===undefined||value==='')return null;
    // Billing days are calendar values, not instants to shift between time zones.
    const dateOnly=typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
    const date=new Date(dateOnly?value+'T12:00:00Z':value);
    if(!Number.isFinite(+date))return null;
    return formatDate(date,format,'en-US',dateOnly||calendar==='UTC'?'UTC':offsetAt(date,this.organization.timezone));
  }
}
