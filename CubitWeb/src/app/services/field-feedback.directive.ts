import { Directive, DoCheck, ElementRef, OnDestroy, Optional, Renderer2, Self } from '@angular/core';
import { NgControl } from '@angular/forms';
let nextId=0;
@Directive({selector:'input[formControlName],input[ngModel],select[formControlName],select[ngModel],textarea[formControlName],textarea[ngModel]'})
export class FieldFeedbackDirective implements DoCheck,OnDestroy {
  private message:HTMLElement; private id='field-error-'+(++nextId); private last='';
  constructor(@Optional() @Self() private control:NgControl,private el:ElementRef,private renderer:Renderer2){}
  ngDoCheck(){
    const c=this.control?.control,e=c?.errors;
    const text=c?.touched&&e?(e.required?'This field is required.':e.email?'Enter a valid email address.':e.phone?'Enter a 10-digit US phone number, such as 321-555-0123.':e.min?'Enter a value of at least '+e.min.min+'.':e.max?'Enter a value no greater than '+e.max.max+'.':e.maxlength?'This value is too long.':'Check this value.') : '';
    if(text===this.last)return;this.last=text;
    if(!this.message){this.message=this.renderer.createElement('small');this.renderer.setAttribute(this.message,'id',this.id);this.renderer.addClass(this.message,'field-error');this.renderer.appendChild(this.el.nativeElement.parentNode,this.message);const described=this.el.nativeElement.getAttribute('aria-describedby');this.renderer.setAttribute(this.el.nativeElement,'aria-describedby',[described,this.id].filter(Boolean).join(' '));}
    this.renderer.setProperty(this.message,'textContent',text);this.renderer.setAttribute(this.el.nativeElement,'aria-invalid',text?'true':'false');
  }
  ngOnDestroy(){if(this.message?.parentNode)this.renderer.removeChild(this.message.parentNode,this.message);}
}
