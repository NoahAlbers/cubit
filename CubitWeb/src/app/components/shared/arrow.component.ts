import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
    selector: 'app-arrow',
    template: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use [attr.href]="'/assets/icons/cubit-arrows.sprite.svg#cubit-' + name"></use></svg>`,
    host: { 'aria-hidden': 'true' },
    styles: [':host{display:inline-flex;width:16px;height:16px;flex:0 0 16px;vertical-align:-3px;color:inherit;pointer-events:none}svg{display:block;width:100%;height:100%}'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ArrowComponent {
  @Input() name = 'arrow-right';
}
