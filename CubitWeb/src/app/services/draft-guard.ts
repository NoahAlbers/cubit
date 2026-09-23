import { Component, Directive, HostListener, Inject, Input, Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';

export interface DraftPage {
  hasUnsavedChanges(): boolean;
  discardDraft(): void;
  saveDraft?(): Promise<boolean>;
  canSaveDraft?(): boolean;
}
@Component({selector:'app-draft-dialog',template:`<div class="cubit-dialog"><h2 mat-dialog-title>Unsaved changes</h2><p>Your changes have not been saved.</p><p *ngIf="!data.canSave">Stay on this page to review and save each unfinished section.</p><div class="actions"><button class="secondary" (click)="ref.close('stay')" cdkFocusInitial>Stay</button><button class="secondary" (click)="ref.close('discard')">Discard changes</button><button *ngIf="data.canSave" class="primary" (click)="ref.close('save')">Save and leave</button></div></div>`})
export class DraftDialogComponent {
  constructor(public ref:MatDialogRef<DraftDialogComponent>,@Inject(MAT_DIALOG_DATA) public data:any){}
}
@Injectable({providedIn:'root'})
export class DraftGuard implements CanDeactivate<DraftPage> {
  constructor(private dialog:MatDialog){}
  async confirmDiscard(){return (await this.dialog.open(DraftDialogComponent,{data:{canSave:false},ariaLabel:'Unsaved changes',width:'440px'}).afterClosed().toPromise())==='discard';}
  async canDeactivate(page:DraftPage) {
    if(!page.hasUnsavedChanges())return true;
    const canSave=!!page.saveDraft && (page.canSaveDraft?.()??true);
    const choice=await this.dialog.open(DraftDialogComponent,{data:{canSave},ariaLabel:'Unsaved changes',width:'440px'}).afterClosed().toPromise();
    if(choice==='save')return page.saveDraft!();
    if(choice==='discard'){page.discardDraft();return true;}
    return false;
  }
}
@Directive({selector:'[appDraft]'})
export class DraftExitDirective {
  @Input() appDraft=false;
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.appDraft){event.preventDefault();event.returnValue='';}}
}
