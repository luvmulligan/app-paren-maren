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
  public canParenMaren = signal<boolean | null>(false);
  public multiplier = signal<number | undefined>(1);
  public parenMarenPressed = signal<boolean | undefined>(false);
  public blackDiceUrl: string= '';

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
    });
    this.rt.canParenMaren().subscribe(value =>{
      this.canParenMaren.set(value)
    })
      this.rt.startGame().then((data)=>{
    });
    this.rt.parenMarenPressed().subscribe((value)=>{
      this.parenMarenPressed.set(value!)
    })
    this.rt.multiplier().subscribe((value)=>{
      this.multiplier.set(value!)
      
    })
    
    this.rt.roomChanges().subscribe((data)=>{
      console.log(data)
      this.blackDiceUrl = `assets/black-dice-${this.multiplier()}.png`

    })
    }

    rollDice(){
      if(this.dice().length === 4){
        this.rt.endTurn();
      };
      this.rt.rollDice().then((data)=>{
      });
    }
    leaveRoom(){
      this.rt.leaveRoom();
    }

    rollParenMaren(){
      this.rt.rollParenMaren()
      console.log(this.parenMarenPressed())
    }
}
