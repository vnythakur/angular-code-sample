import { Component, OnInit, Input, EventEmitter, Output, ViewChild, AfterViewInit, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { FormGroup, FormControl, Validators, FormArray, FormBuilder } from '@angular/forms';
import { map, startWith, debounceTime, switchMap, tap, catchError, withLatestFrom, shareReplay } from 'rxjs/operators';
import { Observable, from, combineLatest } from 'rxjs';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Meeting } from '../../../models/meeting';
import { User } from '../../../models/user';
import { AgendaItem } from '../../../models/agenda-item';
import { Invite } from '../../../models/invite';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { RootStoreState } from '../../../root-store';
import { throwToolbarMixedModesError } from '@angular/material/toolbar';
import { AuthService } from 'src/app/services/auth.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { InviteGuestComponent } from './invite-guest/invite-guest.component';
import { MeetingFormService } from './meeting-form.service';


@Component({
  selector: 'app-meeting-form',
  templateUrl: './meeting-form.component.html',
  styleUrls: ['./meeting-form.component.scss'],
})
export class MeetingFormComponent implements OnInit, AfterViewInit {

  @ViewChild('meetingName') meetingName: ElementRef;
  @ViewChildren('agendaItemName') agendaItemName: QueryList<ElementRef>;
  @ViewChildren('expectedOutcomeItemName') expectedOutcomeItemName: QueryList<ElementRef>;

  @Input()
  meeting: Meeting;

  @Output()
  onSubmit = new EventEmitter<Meeting>();

  @Output()
  onCancel = new EventEmitter();

  @Output()
  changes = new EventEmitter<any>();

  @Output()
  inviteChanges = new EventEmitter<any>();

  owner: User;
  invites$: Observable<Invite[]>;
  totalTime$: Observable<number>;
  hasRequiredInvitees$: Observable<boolean>;
  showPrepSectionBtn$: Observable<boolean>;

  // showPrepForm: boolean;

  meetingForm: FormGroup;

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private breakpointObserver: BreakpointObserver,
    private _bottomSheet: MatBottomSheet,
    private meetingFormService: MeetingFormService
  ) {}

  ngOnInit() {
    // this.showPrepForm = (!!this.meeting.prep?.description || !!this.meeting.prep?.time);

    this.owner = this.meeting.owner;

    this.meetingForm = this.fb.group({
      id: this.meeting.id,
      name: [this.meeting.name, Validators.required],
      objectives: this.fb.array(this.meeting.objectives.map((item) => this.objectiveGroup(item))),
      agenda: this.fb.array(this.meeting.agenda.map((item) => this.agendaGroup(item))),
      invites: this.fb.array(this.meeting.invites.map((item) => this.inviteGroup(item))),
      users: ['', Validators.email],
      prep: this.prepGroup(this.meeting.prep)
    });

    this.meetingFormService.selectedMeetingForm = this.meetingForm;
    this.meetingFormService.selectedMeeting = this.meeting;

    this.totalTime$ = this.agenda.valueChanges.pipe(
      map((agendaArr: AgendaItem[]) => agendaArr.reduce((cnt, item) => cnt + item.timeLimit, 0)),
      startWith(this.meeting.agenda.reduce((sum, item) => sum += item.timeLimit, 0))
    )

    let inviteChanges$ = this.invites.valueChanges.pipe(
      startWith(this.invites.value)
    )

    this.invites.valueChanges.subscribe(this.inviteChanges)

    this.changes.emit(Object.entries(this.meetingForm.controls).map(([name, ctrl]) => {
      const change$ = ctrl.valueChanges.pipe(
        map((change) => {
          return [name, change]
        })
      );
      return [name, change$];
    }))

  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.meetingName.nativeElement.focus();
    });
  }

  get name() {
    return this.meetingForm.get('name') as FormControl;
  }

  get agenda() {
    return this.meetingForm.get('agenda') as FormArray;
  }

  get objectives() {
    return this.meetingForm.get('objectives') as FormArray;
  }

  get invites() {
    return this.meetingForm.get('invites') as FormArray;
  }

  get usersCtrl() {
    return this.meetingForm.get('users') as FormControl;
  }

  get prep() {
    return this.meetingForm.get('prep') as FormGroup;
  }

  dropAgendaItem(event: CdkDragDrop<FormControl>) {
    moveItemInArray(this.agenda.controls, event.previousIndex, event.currentIndex);
    this.agenda.controls.forEach((ctrl, index) => ctrl.get('order').setValue(index));
  }

  dropOutcome(event: CdkDragDrop<FormControl>) {
    moveItemInArray(this.objectives.controls, event.previousIndex, event.currentIndex);
    // Weird bug. It seems you need to make a change to the new objectives for it to register they have changed
    this.objectives.controls.forEach((ctrl, index) => ctrl.get('description').setValue(ctrl.get('description').value));
  }

  showPrepSection() {
    return this.meeting.prep
  }

  prepGroup(prep: { description?: string, time?: number} = {}) {
    return this.fb.group({
      description: prep.description,
      time: prep.time
    })
  }
  
  addObjective() {
    this.objectives.push(this.objectiveGroup());
    setTimeout(() => {
      const expectedOutcomeItem = this.expectedOutcomeItemName.toArray();
      expectedOutcomeItem[expectedOutcomeItem.length - 1].nativeElement.focus();
    });
  }

  removeObjective(index: number) {
    this.objectives.removeAt(index);
  }

  addAgendaItem() {
    const ctrl = this.agendaGroup({
      item: '',
      order: this.agenda.length,
      timeLimit: null
    });
    this.agenda.push(ctrl);
    setTimeout(() => {
      const agendaItems = this.agendaItemName.toArray();
      agendaItems[agendaItems.length - 1].nativeElement.focus();
    });
  }

  removeAgendaItem(index: number) {
    this.agenda.removeAt(index);
  }

  displayInUsers(invite: Invite) {
    return invite.user?.email;
  }

  

  submit() {
    if(this.meetingForm.valid){
      const meeting = {
        ...this.meetingForm.value
      }

      // Delete props used for form editing
      delete meeting.users;
      delete meeting.prepFormShown;
  
      // Remove any empty content agenda items or outcomes
      meeting.agenda = meeting.agenda.filter((item) => item.item || item.timeLimit)
      meeting.objectives = meeting.objectives.filter((outcome) => outcome.description )
  
      // Add other props not editable in form
      meeting.owner = this.meeting.owner;
      meeting.status = this.meeting.status;
      
      if(this.meeting.id) {
        meeting.id = this.meeting.id;
      }

      this.onSubmit.emit(meeting);
    }
  
  }

  cancel() {
    this.onCancel.emit();
  }

  private inviteGroup(item: Invite) {
    return this.fb.group({
      user: [item.user],
      optional: [item.optional]
    });
  }
  

  private agendaGroup(item: AgendaItem = {id: null, order: null, item:'', timeLimit: null}) {
    return this.fb.group({
      id: item.id,
      order: [item.order],
      item: [item.item, Validators.required],
      timeLimit: [item.timeLimit, Validators.required]
    })
  }

  private objectiveGroup(item = { description:'', achieved: false}) {
    return this.fb.group({
      description: [item.description],
      achieved: [item.achieved]
    })
  }

  openInviteGuestBottomSheet(): void {
    const bottomSheetRef = this._bottomSheet.open(InviteGuestComponent, {
      panelClass: 'app-bottom-sheet-wrapper-cls'
    });

    bottomSheetRef.afterDismissed().subscribe(() => {
      console.log('Closed bottom sheet');
    });
  }

}
