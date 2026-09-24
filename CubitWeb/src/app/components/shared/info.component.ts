import { Component, Input, TemplateRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

@Component({
    selector: 'app-info', template: `
  <button type="button" class="info-button" [attr.aria-label]="'About '+title" [title]="'About '+title" (click)="open()"><img src="assets/icons/info-circle.svg" alt=""></button>
  <ng-template #content><div class="cubit-dialog info-dialog"><h2 mat-dialog-title>{{title}}</h2><mat-dialog-content><ng-content></ng-content></mat-dialog-content><div class="actions"><button type="button" class="primary" mat-dialog-close>Got it</button></div></div></ng-template>
`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InfoComponent {
  @Input() title=''; @ViewChild('content') content!:TemplateRef<any>;
  constructor(private dialog:MatDialog){}
  open(){this.dialog.open(this.content,{width:'480px',maxWidth:'calc(100vw - 32px)',ariaLabel:this.title});}
}
