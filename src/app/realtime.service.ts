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
  winner?: string | null;

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
  private readonly serverUrl = 'https://app-paren-maren.onrender.com';

  constructor(private zone: NgZone) {}

  connect(): void {
    if (this.socket && this.socket.connected) return;
    // prefer the default transport strategy (polling -> upgrade to websocket)
    // forcing websocket-only can fail on some proxies or hosting providers — allow polling first
    this.socket = io(this.serverUrl, {
      // allow polling fallback to ensure the connection can be established
      transports: ['polling', 'websocket'],
      // wait longer for the connection in case of cold servers
      timeout: 20000,
      // reconnection settings (socket.io defaults are ok, but make explicit)
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket?.on('connect', () => {
      this.zone.run(() => this.connected$.next(true));
    });

    this.socket?.on('disconnect', () => {
      this.zone.run(() => this.connected$.next(false));
    });

    // helpful debug hooks for connection issues — surface errors into lastError$
    this.socket?.on('connect_error', (err: any) => {
      const msg = err && err.message ? err.message : String(err);
      // keep lastError$ updated so UI can show useful messages
      this.zone.run(() => this.lastError$.next(`connect_error: ${msg}`));
      // also log to console for developer diagnostics
      // eslint-disable-next-line no-console
      console.warn('socket connect_error', err);
    });

    this.socket?.on('connect_timeout', (timeout) => {
      this.zone.run(() => this.lastError$.next('connect_timeout'));
      // eslint-disable-next-line no-console
      console.warn('socket connect_timeout', timeout);
    });

    this.socket?.on('reconnect_failed', () => {
      this.zone.run(() => this.lastError$.next('reconnect_failed'));
      // eslint-disable-next-line no-console
      console.warn('socket reconnect_failed');
    });

    this.socket?.on('roomUpdated', (room: RoomDto) => {
      this.zone.run(() => this.handleRoomUpdated(room));
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

  // Centralized handler so tests can call it directly and we ensure
  // the persistent subjects (multiplier, parenMarenPressed, canParenMaren)
  // get updated whenever the server sends a room update.
  private handleRoomUpdated(room: RoomDto | null): void {
    // Update transient/persistent subjects first so subscribers that react
    // to a room update and inspect other observables/signals will see
    // consistent state (no stale multiplier/pressed values).
    this.diceView$.next([...(room?.dice ?? [])]);
    if (room) {
      if (typeof room.canParenMaren === 'boolean') this.canParenMaren$.next(room.canParenMaren);
      if (typeof room.parenMarenPressed === 'boolean') this.parenMarenPressed$.next(room.parenMarenPressed);
      if (typeof room.multiplier === 'number') this.multiplier$.next(room.multiplier);
    }

    // Finally emit the room snapshot. Doing this after the above ensures
    // components receiving `roomChanges` that also read `multiplier()` or
    // `parenMarenPressed()` observe the new values immediately.
    this.room$.next(room);
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
        
          } else if (ack?.error) {
            this.lastError$.next(ack.error);
          }
          if (typeof ack.canParenMaren === 'boolean') this.canParenMaren$.next(ack.canParenMaren)
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
            if (typeof ack.parenMarenPressed === 'boolean') this.parenMarenPressed$.next(ack.parenMarenPressed);
            if (typeof ack.multiplier === 'number') this.multiplier$.next(ack.multiplier);
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
