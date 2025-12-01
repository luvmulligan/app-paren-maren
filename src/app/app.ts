import { Component, effect, OnInit, signal } from '@angular/core';
import { RealtimeService } from './realtime.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
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
  public scores: number[] = [];
  public rollResult!: number;
  public players: any[] = [];
  public canRoll: boolean = true;
  public newPlayer: string = '';
  
  // roomId: string;
  // playerId: string;
  // name?: string;
  // createIfMissing?: boolean;
  // Generate a per-session unique numeric player id so different browser instances
  // don't collide when joining the same room. Using Date.now() + a small
  // random offset is good enough for this demo.
  playerId: number = Date.now() + Math.floor(Math.random() * 1000);
  joined = false;
  private readonly LS_KEY = 'parenMaren';

    constructor(private rt: RealtimeService){
      effect(()=>{
        this.currentPlayer.set(this.newPlayer)
        
      })
    this.rt.connect()

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
   
    this.rt.parenMarenPressed().subscribe((value)=>{
      this.parenMarenPressed.set(value!)
    })
    this.rt.multiplier().subscribe((value)=>{
      console.log(value)
      this.multiplier.set(value!)
      
    })
    
      this.rt.roomChanges().subscribe((data) => {
      console.log(data)
        // Populate players from the room snapshot so the players list in the UI renders.
        this.players = data?.players ?? [];
          // Update the visible "currentPlayer" name from the room snapshot.
          if (data) {
            const turnIndex = typeof data.turnIndex === 'number' ? data.turnIndex : 0;
            const idAtTurn = data.turnOrder?.[turnIndex];
            const current = (data.players ?? []).find((p: any) => String(p.id) === String(idAtTurn));
            this.currentPlayer.set(current?.name ?? '');
            if(this.newPlayer === current?.name){
              this.canRoll = true;
            }else{
              this.canRoll = false;
            }
          } else {
            this.currentPlayer.set('');
          }
      const mul = (data && typeof data.multiplier === 'number') ? data.multiplier : this.multiplier();
      this.blackDiceUrl = `assets/black-dice-${mul}.png`

    })

    // Restore persisted join info (if present) and auto-join once socket connects
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) this.newPlayer = parsed.name;
        if (typeof parsed?.playerId === 'number') this.playerId = parsed.playerId;
        // If previously joined, rejoin automatically when socket becomes connected
        if (parsed?.joined) {
          // subscribe once and rejoin when connected
          let sub: any;
          sub = this.rt.connectionChanges().subscribe((connected: boolean) => {
            if (connected) {
              // ensure we attempt to join only once
              this.joined = false;
              this.joinRoom();
              sub.unsubscribe();
            }
          });
        }
      }
    } catch (e) {
      // ignore malformed JSON in storage
    }
    }

    joinRoom(){
      if (!this.newPlayer || this.newPlayer.trim().length === 0) return;
      // Guard: don't let the same client call join multiple times
      if (this.joined) return;

      return this.rt.joinRoom({roomId: 'room1', playerId: this.playerId, name: this.newPlayer, createIfMissing: true}).then((ack)=>{
        if (ack?.ok) {
          this.joined = true;
          this.currentPlayer.set(this.newPlayer);
          // persist join info so a page reload can restore this session
          try {
            localStorage.setItem(this.LS_KEY, JSON.stringify({ playerId: this.playerId, name: this.newPlayer, joined: true }));
          } catch (e) {
            // ignore storage errors
          }
        }
        console.log('joinRoom ack', ack)
      })
    }
    startGame(){
       this.rt.startGame();
    }

    rollDice(){
      if(this.dice().length === 4){
        this.rt.endTurn();
      };
      this.rt.rollDice().then((data)=>{
        
      });
    }
    leaveRoom(){
      this.rt.leaveRoom().then(() => {
        // clear persisted join data
        try { localStorage.removeItem(this.LS_KEY); } catch (e) {}
        this.joined = false;
        this.newPlayer = '';
        this.currentPlayer.set('');
      });
    }

    rollParenMaren(){
      this.rt.rollParenMaren();
      setTimeout(()=>{
        this.rt.endTurn();
      },2000)
     
    }


}
