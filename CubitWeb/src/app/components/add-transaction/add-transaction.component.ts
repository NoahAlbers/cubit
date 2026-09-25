import { organizationDay } from '../../services/org-time';
import { DraftGuard } from '../../services/draft-guard';
import { Component, OnInit, Inject, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { TransactionService } from '../../services/transaction.service';
@Component({
    selector: 'app-add-transaction', templateUrl: './add-transaction.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AddTransactionComponent implements OnInit {
  transactionForm:UntypedFormGroup;error='';busy=false;loading=false;requestKey=crypto.randomUUID();
  methods=['Cash','Paypal','Credit Card','Check'];today=organizationDay();
  constructor(private drafts:DraftGuard,public dialogRef:MatDialogRef<AddTransactionComponent>,@Inject(MAT_DIALOG_DATA) public data:any,
    private transactionService:TransactionService,private http:HttpClient,private fb:UntypedFormBuilder){
    this.transactionForm=this.fb.group({id:[data.id],memberId:[data.memberId],kind:['payment'],transactionDate:[this.today,Validators.required],
      amount:[null,[Validators.required,Validators.min(data.id==='New'?0.01:0),Validators.max(99999999)]],description:[''],method:[''],confirmation:[''],correctionReason:['']});
    this.transactionForm.controls.kind.valueChanges.subscribe(kind=>this.validateKind(kind));
    this.validateKind();
    if(data.id!=='New')this.loadTransaction(data.id);
  }
  get kind(){return this.transactionForm.value.kind;}
  get actionLabel(){return this.kind==='charge'?'Record charge':this.kind==='refund'?'Record refund':'Record payment';}
  get missingFields(){return Object.entries({transactionDate:'date',amount:'amount',description:this.kind==='refund'?'refund reason':'description',correctionReason:'reason for change'}).filter(([key])=>this.transactionForm.controls[key].hasError('required')).map(([,label])=>label);}
  removeEntry(){this.transactionForm.controls.amount.setValue(0);this.transactionForm.markAsDirty();}
  validateKind(kind=this.kind){
    this.transactionForm.controls.description.setValidators(kind==='charge'||kind==='refund'?[Validators.required,Validators.maxLength(255)]:Validators.maxLength(255));
    this.transactionForm.controls.description.updateValueAndValidity();
    this.transactionForm.controls.correctionReason.setValidators(this.data.id!=='New'?[Validators.required,Validators.maxLength(255)]:[]);
    this.transactionForm.controls.correctionReason.updateValueAndValidity();
  }
  loadTransaction(id:string){this.loading=true;this.transactionService.getTransaction(id).subscribe({next:p=>{
    if(p.method && !this.methods.includes(p.method))this.methods.push(p.method);
    this.transactionForm.patchValue({...p,amount:Math.abs(Number(p.amount)),kind:Number(p.amount)<0?'refund':'payment',transactionDate:this.dateInput(new Date(p.transactionDate)),correctionReason:''});
    this.loading=false;
  },error:()=>{this.error='Could not load this entry. Close and try again.';}});}
  async Save(){
    if(this.busy||this.loading||this.transactionForm.invalid)return;this.busy=true;this.error='';
    const v=this.transactionForm.value;
    try{
      if(v.kind==='charge')await this.http.post('/api/cubit/members/'+this.data.memberId+'/charges',{amount:v.amount,date:v.transactionDate,description:v.description,requestKey:this.requestKey}).toPromise();
      else await this.transactionService.saveTransaction({...v,amount:v.kind==='refund'?-Number(v.amount):Number(v.amount),requestKey:this.requestKey});
      this.dialogRef.close('Saved');
    }catch(e){this.busy=false;this.error=e.error?.message||'Could not save the entry.';}
  }
  dateInput(date:Date){return date.toISOString().slice(0,10);}
  async onCancel(){if(this.busy)return;if(this.transactionForm.dirty&&!await this.drafts.confirmDiscard())return;
    this.dialogRef.close('Cancel');}
  ngOnInit(){this.dialogRef.keydownEvents().subscribe(e=>{if(e.key==='Escape'){e.preventDefault();this.onCancel();}});}
}
