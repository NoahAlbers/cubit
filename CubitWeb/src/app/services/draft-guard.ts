import { Component, Directive, HostListener, Inject, Input, Injectable, ChangeDetectionStrategy } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from './security/auth.service';

export interface DraftPage {
  hasUnsavedChanges(): boolean;
  discardDraft(): void;
  saveDraft?(): Promise<boolean>;
  canSaveDraft?(): boolean;
}
@Component({
    selector: 'app-draft-dialog', template: `<div class="cubit-dialog"><h2 mat-dialog-title>Unsaved changes</h2><p>Your changes have not been saved.</p>@if (!data.canSave) {<p>Stay on this page to review and save each unfinished section.</p>}<div class="actions"><button class="secondary" (click)="ref.close('stay')" cdkFocusInitial>Stay</button><button class="secondary" (click)="ref.close('discard')">Discard changes</button>@if (data.canSave) {<button class="primary" (click)="ref.close('save')">Save and leave</button>}</div></div>`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DraftDialogComponent {
  constructor(public ref:MatDialogRef<DraftDialogComponent>,@Inject(MAT_DIALOG_DATA) public data:any){}
}
@Injectable({providedIn:'root'})
export class DraftGuard  {
  constructor(private dialog:MatDialog,private auth:AuthService){}
  async confirmDiscard(){return (await this.dialog.open(DraftDialogComponent,{data:{canSave:false},ariaLabel:'Unsaved changes',width:'440px'}).afterClosed().toPromise())==='discard';}
  async canDeactivate(page:DraftPage) {
    if(!this.auth.validToken())return true;
    if(!page.hasUnsavedChanges())return true;
    const canSave=!!page.saveDraft && (page.canSaveDraft?.()??true);
    const choice=await this.dialog.open(DraftDialogComponent,{data:{canSave},ariaLabel:'Unsaved changes',width:'440px'}).afterClosed().toPromise();
    if(choice==='save')return page.saveDraft!();
    if(choice==='discard'){page.discardDraft();return true;}
    return false;
  }
}
@Directive({
    selector: '[appDraft]',
    standalone: false
})
export class DraftExitDirective {
  constructor(private auth:AuthService){}
  @Input() appDraft=false;
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.appDraft&&this.auth.validToken()){event.preventDefault();event.returnValue='';}}
}
