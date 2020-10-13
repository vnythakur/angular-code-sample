import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingInProgressComponent } from './meeting-in-progress.component';

describe('MeetingInProgressComponent', () => {
  let component: MeetingInProgressComponent;
  let fixture: ComponentFixture<MeetingInProgressComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MeetingInProgressComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MeetingInProgressComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
