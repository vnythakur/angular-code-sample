import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Meeting } from 'src/app/models/meeting';

@Injectable({
  providedIn: 'root'
})
export class MeetingFormService {

  selectedMeeting: Meeting;
  selectedMeetingForm: FormGroup;

  constructor() { }
}
