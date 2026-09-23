import {Directive,ElementRef,Input,OnDestroy,OnInit,Renderer2} from '@angular/core';
import {MatLegacySnackBar as MatSnackBar} from '@angular/material/legacy-snack-bar';

@Directive({selector:'[appCopy]'})
export class CopyFieldDirective implements OnInit,OnDestroy {
  @Input() appCopy:string|undefined;
  @Input() copyLabel='value';
  private button:HTMLButtonElement;private unlisten:()=>void;
  constructor(private el:ElementRef<HTMLElement>,private renderer:Renderer2,private snack:MatSnackBar){}
  ngOnInit(){
    const r=this.renderer;this.button=r.createElement('button');
    r.setAttribute(this.button,'type','button');r.setAttribute(this.button,'aria-label','Copy '+this.copyLabel);r.setAttribute(this.button,'title','Copy '+this.copyLabel);
    r.addClass(this.button,'copy-field-button');r.addClass(this.el.nativeElement,'copyable-field');
    const icon=r.createElement('img');r.setAttribute(icon,'src','assets/icons/copy.svg');r.setAttribute(icon,'alt','');r.appendChild(this.button,icon);r.appendChild(this.el.nativeElement,this.button);
    this.unlisten=r.listen(this.button,'click',(event:Event)=>{void this.copy(event);});
  }
  private async copy(event:Event){
      event.preventDefault();event.stopPropagation();
      const input=this.el.nativeElement.querySelector('input') as HTMLInputElement;
      const value=this.appCopy===undefined?input?.value:this.appCopy;
      if(!value){this.snack.open('Nothing to copy',null,{duration:1800});return;}
      try{await navigator.clipboard.writeText(value);this.snack.open('Copied '+this.copyLabel,null,{duration:1800});}
      catch{this.snack.open('Copy unavailable. Select the value and copy it manually.',null,{duration:3500});}
  }
  ngOnDestroy(){this.unlisten?.();if(this.button?.parentNode)this.renderer.removeChild(this.button.parentNode,this.button);}
}
