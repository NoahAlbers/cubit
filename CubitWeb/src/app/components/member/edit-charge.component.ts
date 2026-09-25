import { DraftGuard } from '../../services/draft-guard';
import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
@Component({
    selector: 'app-edit-charge', template: `
<div class="cubit-dialog" [appDraft]="amount!==data.charge.amount||!!reason"><h2 mat-dialog-title>Edit charge</h2><p>{{data.charge.planName}} · {{data.charge.dueDate |orgDate:'MMM d, y':'UTC'}}</p>
<form (ngSubmit)="save()"><label>Charge amount<input name="amount" type="number" step="0.01" min="0" max="99999999" [(ngModel)]="amount" required [disabled]="busy"></label>
<button type="button" class="quiet" (click)="amount=0" [disabled]="busy">Waive this charge</button>
<label>Reason for change<input name="reason" [(ngModel)]="reason" maxlength="500" required [disabled]="busy" placeholder="e.g. Approved waiver or incorrect amount"></label>
@if (validAmount()) {
  <p class="billing-edit-preview">Charge: {{data.charge.amount |orgCurrency}} <span class="sr-only">to</span> <app-arrow name="arrow-right"></app-arrow> <b>{{amount |orgCurrency}}</b><br>Account balance: {{data.balance |orgCurrency}} <span class="sr-only">to</span> <app-arrow name="arrow-right"></app-arrow> <b>{{newBalance() |orgCurrency}}</b></p>
}
@if (error) {
  <p class="error" role="alert">{{error}}</p>
  }<div class="actions"><button type="button" class="secondary" (click)="cancel()" [disabled]="busy">Cancel</button><button type="submit" class="primary" [disabled]="busy || !validAmount() || amount===data.charge.amount || !reason.trim()">Save change</button></div></form></div>
`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class EditChargeComponent {
  amount:number;reason='';error='';busy=false;key=crypto.randomUUID();
  constructor(private drafts:DraftGuard,@Inject(MAT_DIALOG_DATA) public data:any,public dialog:MatDialogRef<EditChargeComponent>,private http:HttpClient){this.amount=data.charge.amount;this.dialog.keydownEvents().subscribe(e=>{if(e.key==='Escape'){e.preventDefault();this.cancel();}});}
  async cancel(){if(this.busy)return;if((this.amount!==this.data.charge.amount||this.reason)&&!await this.drafts.confirmDiscard())return;this.dialog.close();}
  validAmount(){return typeof this.amount==='number' && Number.isFinite(this.amount) && this.amount>=0 && this.amount<=99999999;}
  newBalance(){return (Math.round(this.data.balance*100)+Math.round(this.amount*100)-Math.round(this.data.charge.amount*100))/100;}
  save(){if(this.busy||!this.validAmount())return;this.busy=true;this.error='';
    this.http.post('/api/cubit/charges/'+this.data.charge.id+'/correct',{amount:this.amount,expectedAmount:this.data.charge.amount,reason:this.reason,requestKey:this.key}).subscribe({
      next:()=>this.dialog.close('Saved'),error:e=>{this.busy=false;this.error=e.error?.message||'Could not save the charge.';}
    });
  }
}
