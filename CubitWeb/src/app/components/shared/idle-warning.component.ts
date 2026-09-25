import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject } from 'rxjs';

@Component({selector:'app-idle-warning',standalone:true,imports:[MatDialogModule,AsyncPipe,A11yModule],changeDetection:ChangeDetectionStrategy.OnPush,
  styles:[`.idle-countdown{font-size:28px;font-weight:650;color:#094fa3;font-variant-numeric:tabular-nums;margin:16px 0}.actions{justify-content:flex-end;flex-wrap:wrap}.muted{font-size:13px}`],
  template:`<div class="cubit-dialog"><h2 mat-dialog-title>Stay signed in?</h2><mat-dialog-content><p>You haven’t used Cubit for 10 minutes.</p><p>Choose Stay signed in to continue. Otherwise, this browser will sign out automatically.</p><div class="idle-countdown" role="timer" aria-live="off" aria-label="Time until automatic sign-out">{{clock(data.remaining|async)}}</div><p class="muted">Unsaved changes will be discarded when you’re signed out.</p></mat-dialog-content><div class="actions"><button type="button" class="secondary" (click)="ref.close('logout')">Sign out now</button><button type="button" class="primary" cdkFocusInitial (click)="ref.close('stay')">Stay signed in</button></div></div>`})
export class IdleWarningComponent {
  constructor(public ref:MatDialogRef<IdleWarningComponent>,@Inject(MAT_DIALOG_DATA) public data:{remaining:BehaviorSubject<number>}){}
  clock(value:number|null){const seconds=Math.max(0,value??120);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
}
