import { DraftGuard } from '../../services/draft-guard';
import { Component, OnInit, Inject, Input } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MemberService } from '../../services/member.service';
import { PlanService } from '../../services/plan.service';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Plan } from '../../entities/plan';

@Component({
  selector: 'app-add-edit-member-plan',
  templateUrl: './add-edit-member-plan.component.html',
  styles: [],
})
export class AddEditMemberPlanComponent implements OnInit {
  @Input()
  memberKey;

  plans = new Observable<Plan[]>();
  planForm: UntypedFormGroup;
  error = '';
  private catalog:any[]=[];

  constructor(private drafts:DraftGuard,
    public dialogRef: MatDialogRef<AddEditMemberPlanComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private memberService: MemberService,
    private fb: UntypedFormBuilder,
    private planService: PlanService
  ) {
    this.planForm = this.fb.group({
      id: [''],
      planId: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: [''],
      memberId: [data.memberId],
    });

    if (data.Id !== 'New') {
      this.loadExisting(data.Id);
    } else {
      this.planForm.controls['id'].setValue('New');
      const now = new Date();
      this.planForm.controls['startDate'].setValue(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
    }
  }

  loadExisting(Id) {
    this.memberService.getPlan(Id).subscribe((data) => {
      this.planForm.patchValue(data);
    });
  }

  async onCancel(): Promise<void> {
    if(this.planForm.dirty&&!await this.drafts.confirmDiscard())return;
    this.dialogRef.close('Cancel');
  }

  Save() {
    if (this.planForm.valid) {
      this.memberService
        .savePlan({...this.planForm.value,catalogRevision:this.catalog.find(p=>p.id===this.planForm.value.planId)?.revision})
        .then((result) => {
          this.dialogRef.close('Saved');
        })
        .catch((error) => {
          this.error = error.error?.message || 'Could not save the plan.';
        });
    } else {
      this.error = 'Please fill in requred fields';
    }
  }

  ngOnInit() {
    this.dialogRef.keydownEvents().subscribe(e=>{if(e.key==='Escape'){e.preventDefault();this.onCancel();}});
    this.plans = this.planService.getPlanList().pipe(tap(plans=>this.catalog=plans));
  }
}
