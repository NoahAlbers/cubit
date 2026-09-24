import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { WaiverPreviewService } from '../../services/waiver-preview.service';

@Component({
    selector: 'app-waiver-lock', template: `
<section class="waiver-lock"><span class="badge">Work in progress</span><h2>Waivers preview</h2><p>This feature is still being built. Enter the preview password to explore it.</p><form (ngSubmit)="unlock()"><label>Preview password<input type="password" name="previewPassword" [(ngModel)]="password" autocomplete="off" required [disabled]="busy"></label>@if (error) {
<p class="error" role="alert">{{error}}</p>
}<button class="primary" type="submit" [disabled]="busy||!password">{{busy?'Unlocking…':'Unlock preview'}}</button></form></section>
`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class WaiverLockComponent {
  @Output() unlocked=new EventEmitter<void>();password='';error='';busy=false;
  constructor(private gate:WaiverPreviewService){}
  unlock(){if(this.busy)return;this.busy=true;this.error='';this.gate.unlock(this.password).subscribe({next:()=>{this.busy=false;this.password='';this.unlocked.emit();},error:e=>{this.busy=false;this.error=e.error?.message||'Unable to unlock the preview.';}});}
}
