import {Directive,ElementRef,HostListener,forwardRef,Pipe,PipeTransform} from '@angular/core';
import {AbstractControl,NG_VALIDATORS,Validator} from '@angular/forms';
import {formatPhone,validEmail} from './contact-format';

@Directive({
    selector: 'input[type=email],input[type=tel]', providers: [{ provide: NG_VALIDATORS, useExisting: forwardRef(() => ContactFieldsDirective), multi: true }],
    standalone: false
})
export class ContactFieldsDirective implements Validator {
  constructor(private element:ElementRef<HTMLInputElement>){}
  validate(control:AbstractControl){
    const value=control.value;
    if(value===null||value===undefined||value==='')return null;
    return this.element.nativeElement.type==='tel'?(formatPhone(value)!==null?null:{phone:true}):(validEmail(value)?null:{email:true});
  }
  @HostListener('blur') normalize(){
    const input=this.element.nativeElement;
    const value=input.type==='tel'?formatPhone(input.value):input.value.trim();
    if(value!==null&&value!==input.value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
  }
}
@Pipe({
    name: 'phone',
    standalone: false
})
export class PhonePipe implements PipeTransform {
  transform(value:unknown){return formatPhone(value)??value;}
}
