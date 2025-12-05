import { Component, effect, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';
import {MatButtonModule} from '@angular/material/button';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatChipsModule} from '@angular/material/chips';



@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, MatProgressBarModule, MatButtonModule,MatIconModule,MatButtonModule, MatFormFieldModule,MatInputModule,MatChipsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit{
  protected readonly title = signal('Paren Maren');
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
  public sixSound = new Audio('assets/six.mp3');
  public blackDiceUrl: string= '';
  public scores: number[] = [];
  public rollResult!: number;
  public players: any[] = [];
  public canRoll: boolean = true;
  public isEndingTurn: boolean = false;
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
      this.sixSound.preload = 'auto';
      this.sixSound.load();
    } catch (e) {
      console.warn('Could not preload sounds', e);
    }
    this.rt.diceViewChanges().subscribe(d => {
      this.dice.set([...d]);
    });
    this.rt.lastRollChanges().subscribe(last => {
      this.last.set(last);
      // Reproducir sonido cuando cualquier jugador tira (last cambia de null a un número)
      if (last !== null) {
        if (last === 6) {
          this.playSixSound();
        } else {
          this.playDiceSound();
        }
      }
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
            if(this.newPlayer === current?.name ){
              // Si vuelve a ser nuestro turno y estaba marcado como finalizando, resetearlo
              if (this.isEndingTurn && data.dice && data.dice.length === 0) {
                // Si los dados están vacíos significa que es un nuevo turno
                this.isEndingTurn = false;
              }
              // Solo permitir rolling si no estamos finalizando el turno
              if (!this.isEndingTurn) {
                this.canRoll = true;
              }
              // Si vuelve a ser nuestro turno después de una ronda completa, resetear isEndingTurn
              // (esto maneja el caso de que el turno vuelva a nosotros después de haber hecho Paren Maren)
            }else{
              this.canRoll = false;
              this.isEndingTurn = false; // resetear cuando ya no es nuestro turno
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

    // Escuchar cambios en la conexión para reconectar automáticamente
    this.rt.connectionChanges().subscribe((connected: boolean) => {
      if (connected && !this.joined) {
        // Si el socket se reconecta y teníamos una sesión guardada, volver a unirse
        const raw = localStorage.getItem(this.LS_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed?.joined && parsed?.roomId) {
              console.log('Socket reconnected, rejoining room...');
              this.joinRoom();
              this.gameCreated = true;
            }
          } catch (e) {
            // ignore malformed JSON
          }
        }
      }
    });
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
      // Prevent multiple rapid clicks from issuing multiple roll requests
      if (!this.canRoll) return;
      // Lock rolling immediately to avoid duplicate requests
      this.canRoll = false;

      // If for some reason there are already 4 or more dice, end the turn
      if (this.dice().length >= 4) {
        this.rt.endTurn();
        return;
      }
      

      this.rt.rollDice().then((ack: { ok: boolean; last?: number; dice?: number[]; error?: string }) => {
        // Si el resultado del dado es menor o igual a 3, termina el turno
        if (typeof ack.last === 'number' && ack.last <= 3) {
          this.canRoll = false
          setTimeout (() => { this.rt.endTurn();}, 2000);
         
        }
        // server emitirá el nuevo estado y roomChanges() actualizará canRoll
      }).catch(err => {
        console.warn('rollDice failed', err);
        // restore ability to roll on error
        this.canRoll = true;
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
      this.canRoll = false;
      this.isEndingTurn = true; // Marcar que estamos finalizando el turno
      
      this.rt.rollParenMaren().then((ack) => {
        // Reproducir sonido según el resultado del multiplicador
        if (typeof ack.multiplier === 'number') {
          if (ack.multiplier === 6) {
            this.playSixSound();
          } else {
            this.playDiceSound();
          }
        }
      });
      
      setTimeout(()=>{
        this.rt.endTurn();
        // Resetear isEndingTurn después de un pequeño delay adicional para asegurar que roomChanges se procese
        setTimeout(() => {
          this.isEndingTurn = false;
        }, 100);
      },1000)
     
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

    // Play six sound when rolling a 6
    private playSixSound(): void {
      try {
        const s = this.sixSound.cloneNode(true) as HTMLAudioElement;
        s.currentTime = 0;
        const p = s.play();
        if (p !== undefined) {
          p.catch(err => console.warn('sixSound play prevented', err));
        }
      } catch (e) {
        console.warn('playSixSound error', e);
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

    copyRoomId(){
      navigator.clipboard.writeText(this.roomId).then(() => {
        console.log('Room ID copied to clipboard');
      }).catch(err => {
        console.error('Could not copy Room ID: ', err);
      });
    
    }

    exitRoom(){
      const confirmExit = confirm('Are you sure you want to exit? All game progress will be lost.');
      if (!confirmExit) return;
      
      this.leaveRoom();
      this.gameCreated = false;
      this.joined = false;
      this.joinExistingRoomPressed = false;
      this.dice.set([]);
      this.last.set(null);
      this.players = [];
      this.phase = 'lobby';
      this.canRoll = true;
      this.isEndingTurn = false;
      this.roomId = this.generateRoomId();
    }


}
