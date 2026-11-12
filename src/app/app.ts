import { Component } from '@angular/core';
import { PitchBoardComponent } from './pitch-board/pitch-board.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [PitchBoardComponent],
  template: `
    <main class="min-h-screen bg-gray-900 flex items-center justify-center pt-10">
      <app-pitch-board class="w-full"></app-pitch-board>
    </main>
  `
})
export class App {} // Kept exactly as it was in your file
