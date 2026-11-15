import { Routes } from '@angular/router';
import { PitchBoardComponent } from './pitch-board/pitch-board.component';
import { NotFoundComponent } from './core/not-found.component';

export const routes: Routes = [
  { path: '', component: PitchBoardComponent },
  { path: '**', component: NotFoundComponent },
];
