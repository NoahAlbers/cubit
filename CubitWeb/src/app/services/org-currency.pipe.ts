import { Pipe,PipeTransform } from '@angular/core';
import { OrganizationService } from './organization.service';
export function formatMoney(value:number|string,currency:string){return new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));}
@Pipe({name:'orgCurrency',standalone:true,pure:false})
export class OrgCurrencyPipe implements PipeTransform {
 constructor(private organization:OrganizationService){}
 transform(value:number|string|null|undefined){return value===null||value===undefined?null:formatMoney(value,this.organization.currency);}
}
@Pipe({name:'currencyCode',standalone:true,pure:false})
export class CurrencyCodePipe implements PipeTransform {
 constructor(private organization:OrganizationService){}
 transform(_value:unknown){return this.organization.currency;}
}
