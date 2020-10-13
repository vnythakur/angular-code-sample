import { Component, OnInit, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges, OnDestroy, ChangeDetectorRef, EventEmitter, Output, ContentChild, AfterContentInit, Renderer2 } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { Meeting } from 'src/app/models/meeting';
import { User } from 'src/app/models/user';
import { Store } from '@ngrx/store';
import { RootStoreState } from 'src/app/root-store';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { changeAgendaItem, updateNotes, addTimeForAgendaItem, upsertAction, upsertDecision, updateObjective, removeAction, removeDecision, endMeeting } from 'src/app/root-store/meeting-store/actions';
import { AgendaItem, AgendaSession } from 'src/app/models/agenda-item';

import { AngularFirestore } from '@angular/fire/firestore';
import { Objective } from 'src/app/models/objective';
import { MeetingService } from 'src/app/services/meeting.service';
import { Action } from 'src/app/models/action';
import { Decision } from 'src/app/models/decision';
import { SubmitDirective } from './submit.directive';

@Component({
  selector: 'app-meeting-minutes-form',
  templateUrl: './meeting-minutes-form.component.html',
  styleUrls: ['./meeting-minutes-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MeetingMinutesFormComponent implements OnInit, OnDestroy, OnChanges, AfterContentInit {

  @Input()
  meeting: Meeting;

  @Input()
  user: User;

  @Input()
  activeAgendaItem: string;

  @Input()
  agendaItems: AgendaItem[];

  @Input()
  enableClock: boolean;

  @Output()
  onAgendaItemMove = new EventEmitter();

  @Output()
  onNoteChange = new EventEmitter();

  @Output()
  onActionChange = new EventEmitter();

  @Output()
  onDecisionChange = new EventEmitter();

  @Output()
  onActionDeleted = new EventEmitter();

  @Output()
  onDecisionDeleted = new EventEmitter();

  @Output()
  onAddTime = new EventEmitter();

  @Output()
  onSubmit = new EventEmitter();

  @ContentChild(SubmitDirective)
  submitButton: SubmitDirective;

  agendaItemChanges$: Subject<{ agendaItemIndex: number, noteChange: any}>;

  isNotetaker: boolean;
  isOwner: boolean;

  users: User[];

  totalTime: number;
  minutesForm: FormGroup;

  subscriptions: Subscription[];

  notetakerLabel: string;


  constructor(private store: Store<RootStoreState.State>, 
    private fb: FormBuilder, 
    private meetingsService: MeetingService, 
    private cd: ChangeDetectorRef,
    private renderer: Renderer2) {
    this.subscriptions = [];
  }

  get agenda() {
    return this.minutesForm.get('agenda') as FormArray
  }

  set agenda(formArray: FormArray) {
    this.minutesForm.setControl('agenda', formArray);
  }

  get objectives() {
    return this.minutesForm.get('objectives') as FormArray
  }

  ngAfterContentInit() {
    if(this.renderer && this.submitButton){
      this.renderer.listen(this.submitButton.elementRef.nativeElement, 'click', this.submit.bind(this)) 
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
   if(changes.agendaItems) {
    this.calcTotalTime();
   }
  }

  ngOnDestroy() {
    this.subscriptions?.map((sub) => sub.unsubscribe())
  }

  ngOnInit(): void {
    this.isNotetaker = this.meeting.invites.some(invite => invite?.user?.uid === this.user.uid && !!invite.notetaker);
    this.isOwner = this.user?.uid === this.meeting.owner?.uid;

    this.setNotetakerLabel();

    this.users = this.meeting.invites.map((invite) => invite.user )
    this.users.push(this.meeting.owner);

    this.minutesForm = this.fb.group({
      'id': this.meeting.id,
      'agenda': this.agendaItemArray(this.agendaItems),
      'objectives': this.fb.array((this.meeting.objectives ?? []).map((objective, index) => this.objectiveGroup(index, objective)))
    })

    if(!this.enableClock) {
      this.enableClock = this.meeting.status !== 'ENDED' && this.meeting.status !== 'FINALISED';
    }
  }

  agendaItemArray(agendaItems: AgendaItem[]) {
    return this.fb.array((agendaItems ?? []).map((agendaItem) => this.agendaItemCtrl(agendaItem)))
  }

  agendaItemCtrl(agendaItem: AgendaItem) {
    return this.fb.control(agendaItem)
  }

  objectiveGroup(index: number, objective: Objective) {
    const grp = this.fb.group({
      'index': index,
      'achieved': objective.achieved,
      'description': objective.description
    })

    const sub = grp.valueChanges.subscribe(
      ({ index, description, achieved }) => {
        this.store.dispatch(updateObjective({ meetingId: this.meeting.id, objectiveIndex: index, objective: { description: description, achieved: achieved } }));
      }
    )

    this.subscriptions.push(sub);

    return grp;
  }

  calcTotalTime() {
    this.totalTime = this.agendaItems.reduce((sum, item) => (sum + item.timeLimit || 0), 0)
  }

  moveToAgendaItem(toId: string) {

    if(this.meeting.status !== 'ENDED' && this.meeting.status !== 'FINALISED'){
      const agenda = this.agenda.value;

      let oldAgendaItemIndex = agenda.findIndex((agendaItem) => agendaItem.id === this.activeAgendaItem);
      let newAgendaItemIndex = agenda.findIndex((agendaItem) => agendaItem.id === toId )

      const switchTime = new Date().getTime();

      if(oldAgendaItemIndex !== -1 && newAgendaItemIndex !== -1){
        
        const oldAgendaItem: AgendaItem = {
          ...agenda[oldAgendaItemIndex],
          sessions: this.meetingsService.endLastSession([ ...agenda[oldAgendaItemIndex].sessions ], switchTime)
        }

        const newAgendaItem: AgendaItem = {
          ...agenda[newAgendaItemIndex],
          sessions: [
            ...(agenda[newAgendaItemIndex].sessions ?? []),
            { startedAt: switchTime }
          ]
        }
    
        this.agenda.at(oldAgendaItemIndex).setValue(oldAgendaItem);
        this.agenda.at(newAgendaItemIndex).setValue(newAgendaItem);

        this.onAgendaItemMove.emit({ meetingId: this.meeting.id, oldAgendaItem: oldAgendaItem, newAgendaItem: newAgendaItem });
        
      }
    }
    
    this.activeAgendaItem = toId;
    this.cd.markForCheck();

  }

  noteChange(event: { agendaItemId: string, value: any }) {
    console.log('Note change received. Emitting ', { meetingId: this.meeting.id, ...event })
    this.onNoteChange.emit({ meetingId: this.meeting.id, notes: event.value ,...event });
  }

  actionChange(event: { agendaItemId: string, value: Action }) {
    this.onActionChange.emit({ meetingId: this.meeting.id, action: event.value, ...event });
  }

  decisionChange(event: { agendaItemId: string, value: Decision }) {
    this.onDecisionChange.emit({ meetingId: this.meeting.id, decision: event.value, ...event });
  }

  actionDeleted(event: { agendaItemId: string, action: Action }) {
    this.onActionDeleted.emit({ meetingId: this.meeting.id, ...event });
  }

  decisionDeleted(event: { agendaItemId: string, decision: Decision }) {
    this.onDecisionDeleted.emit({ meetingId: this.meeting.id, ...event })
  }

  addTime(event: { agendaItemId: string, sessions: AgendaSession[] }) {
    this.onAddTime.emit({ meetingId: this.meeting.id, ...event });
  }

  submit() {

    if(this.minutesForm.valid){
      this.onSubmit.emit(this.minutesForm.value)
    } else {
      console.log('INVALID ', this.minutesForm.errors)
    }
  }

  setNotetakerLabel() {
    const allNotetaker = this.meeting.invites.filter(invite => !!invite.notetaker);
    const len = allNotetaker.length;
    if (len > 0) {
      this.notetakerLabel = (allNotetaker[0].user.displayName || allNotetaker[0].user.email) + (len > 1 ? ` + ${len - 1} others` : '');
    } else {
      this.notetakerLabel = this.meeting.owner.displayName;
    }
  }
}
