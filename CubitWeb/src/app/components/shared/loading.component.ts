import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-loading',
    template: `<div [class.cubit-loading-area]="!compact"><div class="cubit-loader" [class.cubit-loader--compact]="compact" role="status" aria-live="polite" aria-atomic="true"><img class="cubit-loader__gear" src="assets/cubit-loading-gear.svg" alt="" aria-hidden="true" width="32" height="32"><span class="cubit-loader__text">{{label}}</span></div></div>`,
    styles: [':host{display:block}:host.compact{padding:12px 0}'],
    host: { '[class.compact]': 'compact' },
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class LoadingComponent {
  @Input() label='Loading…';
  @Input() compact=false;
}
