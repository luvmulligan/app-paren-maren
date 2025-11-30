import { Injectable, OnDestroy, NgZone } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface PlayerDto {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  score: number;
}

export interface RoomDto {
  id: string;
  createdAt: string;
  hostId: string | null;
  players: PlayerDto[];
  turnOrder: string[];
  turnIndex: number;
  dice: number[];
  phase: 'lobby' | 'playing' | 'ended';
  canParenMaren: boolean;
  parenMarenPressed: boolean;
  multiplier: number;

}

export interface JoinPayload {
  roomId: string;
  playerId: number;
  name?: string;
  createIfMissing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private socket?: Socket;
  private room$ = new BehaviorSubject<RoomDto | null>(null);
  private connected$ = new BehaviorSubject<boolean>(false);
  private lastError$ = new BehaviorSubject<string | null>(null);
  private diceView$ = new BehaviorSubject<number[]>([]);
  private lastRoll$ = new BehaviorSubject<number | null>(null);
  private canParenMaren$ = new BehaviorSubject<boolean | null>(null);
  private parenMarenPressed$ = new BehaviorSubject<boolean | null>(false);
  private multiplier$ = new BehaviorSubject<number | null>(1);


  // Adjust the URL if your server runs elsewhere
  private readonly serverUrl = 'http://localhost:3000';

  constructor(private zone: NgZone) {}

  connect(): void {
    if (this.socket && this.socket.connected) return;
    this.socket = io(this.serverUrl, { transports: ['websocket'] });

    this.socket?.on('connect', () => {
      this.zone.run(() => this.connected$.next(true));
    });

    this.socket?.on('disconnect', () => {
      this.zone.run(() => this.connected$.next(false));
    });

    this.socket?.on('roomUpdated', (room: RoomDto) => {
      this.zone.run(() => {
        this.room$.next(room);
        this.diceView$.next([...(room?.dice ?? [])]);
      });
    });

    this.socket?.on('roomDeleted', () => {
      this.zone.run(() => {
        this.room$.next(null);
        this.diceView$.next([]);
        this.lastRoll$.next(null);
      });
    });

    this.socket?.on('errorMessage', (msg: string) => {
      this.zone.run(() => this.lastError$.next(msg));
    });
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = undefined;
    this.connected$.next(false);
  }

  // Observables for components
  roomChanges(): Observable<RoomDto | null> {
    return this.room$.asObservable();
  }

  connectionChanges(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  lastError(): Observable<string | null> {
    return this.lastError$.asObservable();
  }

  diceViewChanges(): Observable<number[]> {
    return this.diceView$.asObservable();
  }

  lastRollChanges(): Observable<number | null> {
    return this.lastRoll$.asObservable();
  }

   canParenMaren(): Observable<boolean | null> {
    return this.canParenMaren$.asObservable();
  }

    parenMarenPressed(): Observable<boolean | null> {
    return this.parenMarenPressed$.asObservable();
  }

   multiplier(): Observable<number | null> {
    return this.multiplier$.asObservable();
  }

  // Actions
  joinRoom(payload: JoinPayload): Promise<{ ok: boolean; room?: RoomDto; error?: string }> {
    this.ensureSocket();
    return new Promise((resolve) => {
      this.socket!.emit('joinRoom', payload, (ack: any) => {
        this.zone.run(() => {
          if (ack?.ok && ack.room) {
            this.room$.next(ack.room);
            this.diceView$.next([...(ack.room?.dice ?? [])]);
          } else if (!ack?.ok && ack?.error) {
            this.lastError$.next(ack.error);
          }
          resolve(ack);
        });
      });
    });
  }

  startGame(): Promise<{ ok: boolean; error?: string }> {
    this.ensureSocket();
    return new Promise((resolve) => {
      this.socket!.emit('startGame', (ack: any) => {
        this.zone.run(() => {
          if (ack?.ok) {
            this.diceView$.next([]);
            this.lastRoll$.next(null);
          } else if (ack?.error) {
            this.lastError$.next(ack.error);
          }
          resolve(ack);
        });
      });
    });
  }

  rollDice(faces = 6): Promise<{ ok: boolean; last?: number; dice?: number[]; error?: string }> {
    this.ensureSocket();
    return new Promise((resolve) => {
      this.socket!.emit('rollDice', { faces }, (ack: any) => {
        this.zone.run(() => {
          if (ack?.ok) {
            if (Array.isArray(ack.dice)) this.diceView$.next([...(ack.dice as number[])]);
            if (typeof ack.last === 'number') this.lastRoll$.next(ack.last);
            if (ack.canParenMaren) this.canParenMaren$.next(ack.canParenMaren)
          } else if (ack?.error) {
            this.lastError$.next(ack.error);
          }
          resolve(ack);
        });
      });
    });
  }

  rollParenMaren(faces = 6): Promise<{ ok: boolean; canParenMaren?: boolean; parenMarenPressed?: boolean; multiplier?: number; error?: string }> {
    this.ensureSocket();
    return new Promise((resolve) => {
      this.socket!.emit('rollParenMaren', { faces }, (ack: any) => {
        this.zone.run(() => {
          if (ack?.ok) {
            if (Array.isArray(ack.dice)) this.diceView$.next([...(ack.dice as number[])]);
            if(ack.parenMarenPressed) this.parenMarenPressed$.next(ack.parenMarenPressed);
            if (ack.multiplier) this.multiplier$.next(ack.multiplier);
          } else if (ack?.error) {
            this.lastError$.next(ack.error);
          }
          resolve(ack);
        });
      });
    });
  }

  endTurn(): Promise<{ ok: boolean; error?: string }> {
    this.ensureSocket();
    return new Promise((resolve) => {
      this.socket!.emit('endTurn', (ack: any) => {
        this.zone.run(() => {
          if (!ack?.ok && ack?.error) this.lastError$.next(ack.error);
          resolve(ack);
        });
      });
    });
  }

  leaveRoom(): Promise<{ ok: boolean; error?: string }> {
    this.ensureSocket();
    return new Promise((resolve) => {
      this.socket!.emit('leaveRoom', (ack: any) => {
        this.zone.run(() => {
          if (ack?.ok) {
            this.room$.next(null);
            this.diceView$.next([]);
            this.lastRoll$.next(null);
          }
          if (!ack?.ok && ack?.error) this.lastError$.next(ack.error);
          resolve(ack);
        });
      });
    });
  }

  private ensureSocket(): void {
    if (!this.socket) throw new Error('Socket not connected. Call connect() first.');
  }
}
