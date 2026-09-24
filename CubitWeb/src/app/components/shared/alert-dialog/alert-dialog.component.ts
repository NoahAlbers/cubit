import { Component, OnInit, Input, Inject, ChangeDetectionStrategy } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

@Component({
    selector: "app-alert-dialog",
    templateUrl: "./alert-dialog.component.html",
    styles: [],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AlertDialogComponent implements OnInit {
  message;
  reason='';
  OkCancel = false;
  header = "";
  constructor(
    public dialogRef: MatDialogRef<AlertDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.dialogRef.disableClose=false;
    this.message = data.message;
    this.OkCancel = data.OkCancel;
    this.header = data.header || "Warning";
  }

  ngOnInit() {}

  cancel() {
    this.dialogRef.close("cancel");
  }

  ok() {
    if(this.data.requireReason&&!this.reason.trim())return;
    this.dialogRef.close(this.data.requireReason?{reason:this.reason.trim()}:"ok");
  }

  close() {
    this.dialogRef.close();
  }
}
