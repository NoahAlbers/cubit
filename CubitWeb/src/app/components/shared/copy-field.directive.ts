import {Directive,DoCheck,ElementRef,Input,OnDestroy,OnInit,Renderer2} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';

@Directive({
    selector: '[appCopy]',
    standalone: false
})
export class CopyFieldDirective implements OnInit,OnDestroy,DoCheck {
  @Input() appCopy:string|undefined;
  @Input() copyEnabled=true;
  @Input() copyLabel='value';
  private button:HTMLButtonElement;private unlisten:()=>void;
  ngDoCheck(){if(!this.button)return;const input=this.el.nativeElement.querySelector('input');const visible=this.copyEnabled&&!!(input?input.value:this.appCopy)&&(!input||(!input.classList.contains('ng-invalid')&&input.validity.valid));this.renderer.setStyle(this.button,'display',visible?'': 'none');}
  constructor(private el:ElementRef<HTMLElement>,private renderer:Renderer2,private snack:MatSnackBar){}
  ngOnInit(){
    const r=this.renderer;this.button=r.createElement('button');
    const input=this.el.nativeElement.querySelector('input');
    // Keep the input's accessible name separate from the adjacent copy action.
    if(input&&!input.hasAttribute('aria-label')&&!input.hasAttribute('aria-labelledby'))r.setAttribute(input,'aria-label',this.el.nativeElement.textContent.trim());
    r.setAttribute(this.button,'type','button');r.setAttribute(this.button,'aria-label','Copy '+this.copyLabel);r.setAttribute(this.button,'title','Copy '+this.copyLabel);
    r.addClass(this.button,'copy-field-button');r.addClass(this.el.nativeElement,'copyable-field');
    const icon=r.createElement('img');r.setAttribute(icon,'src','assets/icons/copy.svg');r.setAttribute(icon,'alt','');r.appendChild(this.button,icon);
    if(input){
      // Anchor to the input itself so wrapped labels and validation messages
      // cannot move the copy action outside its field.
      const wrapper=r.createElement('span');r.addClass(wrapper,'copy-input-wrap');
      r.insertBefore(input.parentNode,wrapper,input);r.appendChild(wrapper,input);r.appendChild(wrapper,this.button);
    }else r.appendChild(this.el.nativeElement,this.button);
    this.unlisten=r.listen(this.button,'click',(event:Event)=>{void this.copy(event);});
  }
  private async copy(event:Event){
      event.preventDefault();event.stopPropagation();
      const input=this.el.nativeElement.querySelector('input') as HTMLInputElement;
      const value=input?input.value:this.appCopy;
      if(!value){this.snack.open('Nothing to copy',null,{duration:1800});return;}
      try{await navigator.clipboard.writeText(value);this.snack.open('Copied '+this.copyLabel,null,{duration:1800});}
      catch{this.snack.open('Copy unavailable. Select the value and copy it manually.',null,{duration:3500});}
  }
  ngOnDestroy(){this.unlisten?.();if(this.button?.parentNode)this.renderer.removeChild(this.button.parentNode,this.button);}
}
