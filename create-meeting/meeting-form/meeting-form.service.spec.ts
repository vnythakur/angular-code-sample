import { TestBed } from '@angular/core/testing';

import { MeetingFormService } from './meeting-form.service';

describe('MeetingFormService', () => {
  let service: MeetingFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MeetingFormService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
