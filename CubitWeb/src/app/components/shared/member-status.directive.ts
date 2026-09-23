import {Directive,HostBinding,Input} from '@angular/core';
@Directive({selector:'[appMemberStatus]'})
export class MemberStatusDirective {
  @Input() appMemberStatus='';
  @HostBinding('class.active') get active(){return this.appMemberStatus==='Active';}
  @HostBinding('class.inactive') get inactive(){return this.appMemberStatus==='Inactive';}
  @HostBinding('class.canceled') get canceled(){return this.appMemberStatus==='Canceled';}
}
