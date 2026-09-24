import { Directive, ElementRef, Input, OnChanges } from '@angular/core';
import { JdenticonConfig, updateSvg } from 'jdenticon';

const MEMBER_ICON_STYLE: JdenticonConfig = {
  lightness: { color: [0.52, 0.68], grayscale: [0.36, 0.78] },
  saturation: { color: 0.51, grayscale: 0.35 },
  backColor: '#0000',
};

@Directive({
    selector: 'svg[appMemberIcon]',
    standalone: false
})
export class MemberIconDirective implements OnChanges {
  @Input() appMemberIcon = '';

  constructor(private element: ElementRef<SVGElement>) {}

  ngOnChanges() {
    // A stable ID keeps the icon unchanged when contact details are edited.
    updateSvg(this.element.nativeElement, this.appMemberIcon, MEMBER_ICON_STYLE);
  }
}
