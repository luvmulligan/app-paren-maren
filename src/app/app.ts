import { Component, effect, OnInit, signal } from '@angular/core';
import { RealtimeService } from './realtime.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit{
  protected readonly title = signal('paren-maren');
  protected readonly currentPlayer = signal('');
  public dice = signal<number[]>([]);
  public last = signal<number | null>(null);
  public rollResult!: number;
  
  // roomId: string;
  // playerId: string;
  // name?: string;
  // createIfMissing?: boolean;
  id: number =1;

    constructor(private rt: RealtimeService){
      effect(()=>{
        this.currentPlayer.set('Lucía')
        
      })
    this.rt.connect()
    this.rt.joinRoom({roomId: 'room1', playerId: this.id++, name: 'lucia', createIfMissing: true}).then((data)=>{
      console.log('room created', data)
    })
    }

    ngOnInit(){
    this.rt.diceViewChanges().subscribe(d => {
      this.dice.set([...d]);
    });
    this.rt.lastRollChanges().subscribe(last => {
      this.last.set(last);
      console.log(last)
    });
      this.rt.startGame().then((data)=>{
    });
    }

    rollDice(){
      this.rt.rollDice().then((data)=>{
        console.log(data.dice)
      });
    }
    leaveRoom(){
      this.rt.leaveRoom();
    }
}
