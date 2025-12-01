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
    app.joinerId = 'ABCD';
    await app.joinRoom();
    expect(called).toBe(true);
    expect(app.joined).toBe(true);

    // DOM should show the connected hint
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Conectado como Alice');
  });

  it('createNewRoom should generate a 4-letter room id and call joinRoom with it', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const rt = TestBed.inject(RealtimeService) as any;

    let payload: any = null;
    rt.joinRoom = (p: any) => {
      payload = p;
      return Promise.resolve({ ok: true });
    };

    app.newPlayer = 'Creator';
    await app.createNewRoom();

    expect(payload).toBeTruthy();
    expect(typeof payload.roomId).toBe('string');
    expect(payload.roomId.length).toBe(4);
    // ensure app.roomId was set to the generated id
    expect(app.roomId).toBe(payload.roomId);

    // cleanup
    localStorage.removeItem('parenMaren');
  });

  it('joinRoom should uppercase and use provided 4-letter code and persist it', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const rt = TestBed.inject(RealtimeService) as any;

    let payload: any = null;
    rt.joinRoom = (p: any) => {
      payload = p;
      return Promise.resolve({ ok: true });
    };

    app.newPlayer = 'Joiner';
    app.joinerId = 'abCd';
    await app.joinRoom();

    expect(payload).toBeTruthy();
    expect(payload.roomId).toBe('ABCD');
    // ensure localStorage stored the roomId
    const raw = localStorage.getItem('parenMaren');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).roomId).toBe('ABCD');

    // cleanup
    localStorage.removeItem('parenMaren');
  });

  it('should auto-join using persisted state when socket becomes connected', async () => {
    // set persisted state (include a roomId)
    localStorage.setItem('parenMaren', JSON.stringify({ playerId: 12345, name: 'Stored', joined: true, roomId: 'ABCD' }));

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
    app.joinerId = 'QWER';
    await app.joinRoom();

    const raw = localStorage.getItem('parenMaren');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.name).toBe('PersistUser');
    expect(parsed.joined).toBe(true);
    expect(typeof parsed.roomId).toBe('string');
    expect(parsed.roomId.length).toBe(4);

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

    // initialize App lifecycle then emit room update
    // ensure the UI shows the room id status when joined
    app.joined = true;
    fixture.detectChanges();
    await fixture.whenStable();

    // Emit room update after subscription exists
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

  it('should show roomId in UI and allow regeneration', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    // expect the room id text to be present and 4 letters
    const statusText = compiled.querySelector('.status')?.textContent ?? '';
    const idMatch = app.roomId.match(/^[A-Z]{4}$/);
    expect(idMatch).toBeTruthy();
    expect(statusText).toContain(app.roomId);

    // regenerate and assert new id also matches 4-letter format and differs
    const old = app.roomId;
    app.regenerateRoomId();
    expect(app.roomId).not.toBe(old);
    expect(app.roomId.match(/^[A-Z]{4}$/)).toBeTruthy();
  });
});
