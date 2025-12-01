import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { RealtimeService } from './realtime.service';
import { of } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('paren-maren');
  });

  it('joinRoom should call service and set joined/currentPlayer on success', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const rt = TestBed.inject(RealtimeService) as any;

    let called = false;
    rt.joinRoom = (payload: any) => {
      called = true;
      return Promise.resolve({ ok: true });
    };

    app.newPlayer = 'Alice';
    await app.joinRoom();
    expect(called).toBe(true);
    expect(app.joined).toBe(true);

    // DOM should show the connected hint
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Conectado como Alice');
  });

  it('should auto-join using persisted state when socket becomes connected', async () => {
    // set persisted state
    localStorage.setItem('parenMaren', JSON.stringify({ playerId: 12345, name: 'Stored', joined: true }));

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const rt = TestBed.inject(RealtimeService) as any;

    let called = false;
    rt.joinRoom = (payload: any) => {
      called = true;
      return Promise.resolve({ ok: true });
    };

    // simulate a connected socket immediately
    rt.connectionChanges = () => of(true);

    // initialize (ngOnInit run by framework)
    fixture.detectChanges();
    await fixture.whenStable();

    expect(called).toBe(true);
    // persisted username should appear in the UI once joined
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Conectado como Stored');

    // cleanup storage
    localStorage.removeItem('parenMaren');
  });

  it('joinRoom should persist join state to localStorage and leaveRoom should clear it', async () => {
    localStorage.removeItem('parenMaren');

    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const rt = TestBed.inject(RealtimeService) as any;

    rt.joinRoom = (payload: any) => Promise.resolve({ ok: true });
    rt.leaveRoom = () => Promise.resolve({ ok: true });

    app.newPlayer = 'PersistUser';
    await app.joinRoom();

    const raw = localStorage.getItem('parenMaren');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.name).toBe('PersistUser');
    expect(parsed.joined).toBe(true);

    await app.leaveRoom();
    expect(localStorage.getItem('parenMaren')).toBeNull();
  });

  it('should display the current player from room updates', async () => {
    const fixture = TestBed.createComponent(App);
    const rt = TestBed.inject(RealtimeService) as any;

    const room = {
      id: 'r', createdAt: '', hostId: null,
      players: [{ id: 'p1', name: 'PlayerOne', ready: false, connected: true, score: 0 }],
      turnOrder: ['p1'], turnIndex: 0, dice: [], phase: 'playing', canParenMaren: false, parenMarenPressed: false, multiplier: 1
    } as any;

    // Emit room update
    (rt as any).handleRoomUpdated(room);

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    // find the player row that corresponds to PlayerOne and ensure it contains the "En turno" badge
    const rows = Array.from(compiled.querySelectorAll('.player-row')) as HTMLElement[];
    const playerOneRow = rows.find(r => r.textContent?.includes('PlayerOne'));
    expect(playerOneRow).toBeTruthy();
    expect(playerOneRow?.textContent).toContain('En turno');
  });
});
