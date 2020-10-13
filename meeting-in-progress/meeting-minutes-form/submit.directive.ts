import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: 'button[appSubmit]'
})
export class SubmitDirective {

  constructor(public elementRef: ElementRef) { }

}
