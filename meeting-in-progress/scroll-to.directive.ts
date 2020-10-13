import { Directive, HostBinding, HostListener, Input, Inject, Renderer2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Directive({
  selector: '[appScrollTo]'
})
export class ScrollToDirective {

  @Input()
  id: string

  @HostBinding('class.scroll-trigger')
  scrollTo = true;


  constructor(@Inject(DOCUMENT) private document, private renderer: Renderer2) { }

  @HostListener('click')
  scroll() {
    const elem = this.document.getElementById(this.id)
    
    elem.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    this.renderer.setStyle(elem, 'animation', 'fade-out 4s linear')

    // Only way I could get this to work.
    setTimeout(() => this.renderer.setStyle(elem, 'animation', 'none'), 4000)
  }

}
