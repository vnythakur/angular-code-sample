import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Meeting } from 'src/app/models/meeting';
import { Store, select } from '@ngrx/store';
import { RootStoreState } from 'src/app/root-store';
import { selectMeeting, selectMeetingAgendaItems, selectActiveAgendaItem } from 'src/app/root-store/meeting-store/selectors';
import { User } from 'src/app/models/user';
import { selectUser } from 'src/app/root-store/user-store/selectors';
import { AgendaItem } from 'src/app/models/agenda-item';
import { upsertAction, upsertDecision, removeAction, removeDecision, addTimeForAgendaItem, changeAgendaItem, endMeeting, updateNotes } from 'src/app/root-store/meeting-store/actions';
import { MeetingService } from 'src/app/services/meeting.service';
import { withLatestFrom, map } from 'rxjs/operators';

@Component({
  selector: 'app-meeting-in-progress',
  templateUrl: './meeting-in-progress.component.html',
  styleUrls: ['./meeting-in-progress.component.scss']
})
export class MeetingInProgressComponent implements OnInit {

  meeting$: Observable<Meeting>;
  activeAgendaItem$: Observable<string>;
  agendaItems$: Observable<AgendaItem[]>;
  user$: Observable<User>;
  isNotetaker$: Observable<boolean>;
  isOwner$: Observable<boolean>;

  constructor(private store: Store<RootStoreState.State>, private meetingsService: MeetingService) {
    
    this.meeting$ = this.store.pipe(
      select(selectMeeting)
    );

    this.user$ = this.store.pipe(
      select(selectUser)
    )

    this.activeAgendaItem$ = this.store.pipe(
      select(selectActiveAgendaItem)
    )

    this.agendaItems$ = this.store.pipe(
      select(selectMeetingAgendaItems)
    )

    this.isNotetaker$ = this.meeting$.pipe(
      withLatestFrom(this.user$),
      map(([meeting, user]) => meeting.invites.some(invite => invite?.user?.uid === user.uid && !!invite.notetaker))
    )

    this.isOwner$ = this.meeting$.pipe(
      withLatestFrom(this.user$),
      map(([meeting, user]) => user?.uid === meeting?.owner?.uid)
    )

  }

  ngOnInit(): void {
  }

  noteChange(event) {
    this.store.dispatch(updateNotes(event))
  }

  actionChange(event) {
    this.store.dispatch(upsertAction(event));
  }

  decisionChange(event) {
    this.store.dispatch(upsertDecision(event))
  }

  actionDeleted(event) {
    this.store.dispatch(removeAction(event))
  }

  decisionDeleted(event) {
    this.store.dispatch(removeDecision(event))
  }


  addTime(event) {
    this.store.dispatch(addTimeForAgendaItem(event))
  }

  moveToAgendaItem(event) {
    this.store.dispatch(changeAgendaItem(event));
  }

  submit(minutes: Partial<Meeting>) {
    const meeting = this.meetingsService.endMeeting(minutes)
    this.store.dispatch(endMeeting({ meeting: meeting }))
  }

}
