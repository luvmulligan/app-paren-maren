import { Component, effect, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {MatProgressBarModule} from '@angular/material/progress-bar';



@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MatProgressBarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit{
  protected readonly title = signal('paren-maren');
  protected readonly currentPlayer = signal('');

  //UI variables
  public gameCreated: boolean = false;
  public joinExistingRoom: boolean = false;
  public joinExistingRoomPressed: boolean = false;

  public dice = signal<number[]>([]);
  public last = signal<number | null>(null);
  public canParenMaren = signal<boolean | null>(false);
  public multiplier = signal<number | undefined>(1);
  public parenMarenPressed = signal<boolean | undefined>(false);
  public diceSound = new Audio('assets/dice.mp3');
  public blackDiceUrl: string= '';
  public scores: number[] = [];
  public rollResult!: number;
  public players: any[] = [];
  public canRoll: boolean = true;
  public newPlayer: string = '';
  public hostPlayer: string = '';
  public gameStarted: boolean = false;
  public phase: string = 'lobby';
  public roomId: string = this.generateRoomId();
  public joinerId: string = '';
  public createRoom: boolean = true;
  
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
    // ensure audio is preloaded so play() is more reliable
    try {
      this.diceSound.preload = 'auto';
      this.diceSound.load();
    } catch (e) {
      console.warn('Could not preload diceSound', e);
    }
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
            if(current?.id === data.hostId){
              this.hostPlayer = current?.name ?? '';
            }
            this.currentPlayer.set(current?.name ?? '');
            if(this.newPlayer === current?.name){
              this.canRoll = true;
            }else{
              this.canRoll = false;
            }
            this.phase = data.phase;
          } else {
            this.currentPlayer.set('');
          }
          
      const mul = (data && typeof data.multiplier === 'number') ? data.multiplier : this.multiplier();
      this.blackDiceUrl = `assets/black-dice-${mul}.png`
      const winner  = data?.winner;
      if(winner){
        alert(`El ganador es ${winner}!`) }

    })

    // Restore persisted join info (if present) and auto-join once socket connects
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.name) this.newPlayer = parsed.name;
        if (typeof parsed?.playerId === 'number') this.playerId = parsed.playerId;
        if (typeof parsed?.roomId === 'string') {
          this.roomId = parsed.roomId;
          // ensure join attempts use the stored id when rejoining
          this.joinerId = parsed.roomId;
        }
        // If previously joined, rejoin automatically when socket becomes connected
        if (parsed?.joined) {
          // wait for a connected state, take one emission (auto-unsubscribe)
          this.rt.connectionChanges().pipe(take(1)).subscribe((connected: boolean) => {
            if (connected) {
              // ensure we attempt to join only once
              this.joined = false;
              this.joinRoom();
            }
          });
        }
      }
    } catch (e) {
      // ignore malformed JSON in storage
    }
    }

    createNewRoom(){
      if (!this.newPlayer || this.newPlayer.trim().length === 0) return;
      // Guard: don't let the same client call join multiple times
      if (this.joined) return;

      // generate and use a 4-letter room id for the new room and persist locally
      this.roomId = this.generateRoomId();
      this.joinerId = this.roomId;

      return this.rt.joinRoom({roomId: this.roomId, playerId: this.playerId, name: this.newPlayer, createIfMissing: true}).then((ack)=>{
        if (ack?.ok) {
          this.joined = true;
          this.currentPlayer.set(this.newPlayer);
          // persist join info so a page reload can restore this session
          try {
            localStorage.setItem(this.LS_KEY, JSON.stringify({ playerId: this.playerId, name: this.newPlayer, joined: true, roomId: this.roomId }));
          } catch (e) {
            // ignore storage errors
          }
        }
        console.log('createNewRoom ack', ack)
      })
    }

    joinRoom(){
      if (!this.newPlayer || this.newPlayer.trim().length === 0) return;
      // Guard: don't let the same client call join multiple times
      if (this.joined) return;

      // ensure a room id was entered
      if (!this.joinerId || this.joinerId.trim().length !== 4) return Promise.resolve({ ok: false, error: 'invalid room id' });

      return this.rt.joinRoom({roomId: this.joinerId.toUpperCase(), playerId: this.playerId, name: this.newPlayer, createIfMissing: false}).then((ack)=>{
        if (ack?.ok) {
          this.joined = true;
          this.currentPlayer.set(this.newPlayer);
          // persist join info so a page reload can restore this session
          try {
            this.roomId = this.joinerId.toUpperCase();
            localStorage.setItem(this.LS_KEY, JSON.stringify({ playerId: this.playerId, name: this.newPlayer, joined: true, roomId: this.roomId }));
          } catch (e) {
            // ignore storage errors
          }
        }
        console.log('joinRoom ack', ack)
      })
    }
    startGame(){
             this.gameStarted = true;

       this.rt.startGame();
    }

    rollDice(){
      if(this.dice().length === 4){
        this.canRoll= false;
        this.rt.endTurn();
      }else{
      this.rt.rollDice().then(()=>{
        this.playDiceSound();
      })
      };
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
      this.playDiceSound();
      this.rt.rollParenMaren();
      this.canRoll= false;
      setTimeout(()=>{
        this.rt.endTurn();
      },2000)
     
    }

    // Play dice sound safely. Clone the audio element so rapid successive
    // plays can overlap, and catch promise rejections (autoplay policies).
    private playDiceSound(): void {
      try {
        const s = this.diceSound.cloneNode(true) as HTMLAudioElement;
        s.currentTime = 0;
        const p = s.play();
        if (p !== undefined) {
          p.catch(err => console.warn('diceSound play prevented', err));
        }
      } catch (e) {
        console.warn('playDiceSound error', e);
      }
    }

    // Utility: return a random 4-letter uppercase string for room IDs
    generateRoomId(): string {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let out = '';
      for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
      return out;
    }

    regenerateRoomId(){
      this.roomId = this.generateRoomId();
    }


}
