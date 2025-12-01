import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { RealtimeService } from './realtime.service';

describe('RealtimeService (parenMaren state handling)', () => {
  let service: RealtimeService;
  let zone: NgZone;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [RealtimeService] });
    zone = TestBed.inject(NgZone);
    service = new RealtimeService(zone);
  });

  it('should update parenMarenPressed from true to false when server returns false (no truthiness mask)', async () => {
    // first ack -> true
    (service as any).socket = {
      emit: (event: string, payload: any, cb: any) => {
        if (event === 'rollParenMaren') cb({ ok: true, parenMarenPressed: true, multiplier: 3 });
      },
      connected: true
    } as any;

    // capture emissions
    const pressedVals: Array<boolean|null> = [];
    service.parenMarenPressed().subscribe(v => pressedVals.push(v));

    await service.rollParenMaren();

    expect(pressedVals[pressedVals.length - 1]).toBe(true);

    // second ack -> false (should update to false; currently the code only uses truthiness and will NOT overwrite)
    (service as any).socket = {
      emit: (event: string, payload: any, cb: any) => {
        if (event === 'rollParenMaren') cb({ ok: true, parenMarenPressed: false, multiplier: 1 });
      },
      connected: true
    } as any;

    await service.rollParenMaren();

    // expect the last emission to be false
    expect(pressedVals[pressedVals.length - 1]).toBe(false);
  });

  it('should update multiplier even when multiplier is 0 (no truthiness mask)', async () => {
    (service as any).socket = {
      emit: (event: string, payload: any, cb: any) => {
        if (event === 'rollParenMaren') cb({ ok: true, parenMarenPressed: true, multiplier: 5 });
      },
      connected: true
    } as any;

    const multVals: Array<number|null> = [];
    service.multiplier().subscribe(v => multVals.push(v));

    await service.rollParenMaren();
    expect(multVals[multVals.length - 1]).toBe(5);

    (service as any).socket = {
      emit: (event: string, payload: any, cb: any) => {
        if (event === 'rollParenMaren') cb({ ok: true, parenMarenPressed: false, multiplier: 0 });
      },
      connected: true
    } as any;

    await service.rollParenMaren();
    // multiplier should be updated to 0 (currently masked by truthiness)
    expect(multVals[multVals.length - 1]).toBe(0);
  });

  it('handleRoomUpdated should set multiplier and parenMarenPressed from room payload', () => {
    const multVals: Array<number|null> = [];
    const pressedVals: Array<boolean|null> = [];

    service.multiplier().subscribe(v => multVals.push(v));
    service.parenMarenPressed().subscribe(v => pressedVals.push(v));

    // simulate room update with multiplier 4 and pressed true
    const room = { id: 'r', createdAt: '', hostId: null, players: [], turnOrder: [], turnIndex: 0, dice: [], phase: 'playing', canParenMaren: false, parenMarenPressed: true, multiplier: 4 };
    (service as any).handleRoomUpdated(room);

    expect(multVals[multVals.length - 1]).toBe(4);
    expect(pressedVals[pressedVals.length - 1]).toBe(true);

    // now simulate update with pressed false and multiplier 0 -> should update both
    const room2 = { ...room, parenMarenPressed: false, multiplier: 0 };
    (service as any).handleRoomUpdated(room2);

    expect(multVals[multVals.length - 1]).toBe(0);
    expect(pressedVals[pressedVals.length - 1]).toBe(false);
  });

  it('roomChanges subscribers should see updated multiplier value when room is emitted', () => {
    // simulate a subscriber that reads the multiplier subject value synchronously
    const observedMul: number[] = [];
    service.roomChanges().subscribe(() => {
      // read the internal BehaviorSubject value here to emulate a subscriber
      observedMul.push((service as any).multiplier$.getValue());
    });

    const room = { id: 'r', createdAt: '', hostId: null, players: [], turnOrder: [], turnIndex: 0, dice: [], phase: 'playing', canParenMaren: false, parenMarenPressed: true, multiplier: 7 };
    (service as any).handleRoomUpdated(room);

    expect(observedMul[observedMul.length - 1]).toBe(7);
  });
});
