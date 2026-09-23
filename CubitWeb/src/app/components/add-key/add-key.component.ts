import { DraftGuard } from '../../services/draft-guard';
import { Component, OnInit, Inject } from '@angular/core';
import { MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { MemberService } from '../../services/member.service';
import { KeyService } from '../../services/key.service';

@Component({
  selector: 'app-add-key',
  templateUrl: './add-key.component.html',
  styles: [],
})
export class AddKeyComponent implements OnInit {
  keyForm: UntypedFormGroup;
  error = '';
  constructor(private drafts:DraftGuard,
    public dialogRef: MatDialogRef<AddKeyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: UntypedFormBuilder,
    private keyService: KeyService
  ) {
    this.keyForm = this.fb.group({
      id: [''],
      serialNumber: ['', Validators.required],
      memberId: [''],
      status: [''],
    });

    this.keyForm.controls['id'].setValue('New');
    this.keyForm.controls['memberId'].setValue(data.memberKey);
    this.keyForm.controls['status'].setValue('Active');
  }

  Save() {

    if (this.keyForm.valid) {
      this.keyService
        .saveKey(this.keyForm.value)
        .then((result) => {
          this.dialogRef.close('ok');
        })
        .catch((error) => {
          this.error=error.error?.message||'Could not save this key. Please try again.';
        });
    } else {
      this.error = 'Please fill in the serial number';
    }
  }

  async onCancel(): Promise<void> {
    if(this.keyForm.dirty&&!await this.drafts.confirmDiscard())return;
    this.dialogRef.close('Cancel');
  }

  ngOnInit(){this.dialogRef.keydownEvents().subscribe(e=>{if(e.key==='Escape'){e.preventDefault();this.onCancel();}});}
}
