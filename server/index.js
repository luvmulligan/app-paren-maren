// Minimal Express + Socket.IO server to manage multiplayer dice game state
// Run after adding dependencies: express and socket.io
// Usage (after deps): node server/index.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;

// In-memory game state
// Rooms keyed by roomId; each room contains players, turn state, dice, etc.
const rooms = new Map();

function now() {
  return new Date().toISOString();
}

function createRoom(roomId, host) {
  if (rooms.has(roomId)) throw new Error('Room already exists');
  const room = {
    id: roomId,
    createdAt: now(),
    hostId: host.id,
    players: new Map([[host.id, { id: host.id, name: host.name, ready: false, connected: true }]]),
    turnOrder: [host.id],
    turnIndex: 0,
    dice: [],
    rollResult: 0,
    multiplier: 1,
    blackDiceRolled: false,
    canParenMaren: false,
    canRoll: false,
    phase: 'lobby', // lobby | playing | ended
  };
  rooms.set(roomId, room);
  return room;
}

function getRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error('Room not found');
  return room;
}

function ensurePlayer(room, playerId) {
  const p = room.players.get(playerId);
  if (!p) throw new Error('Player not in room');
  return p;
}

function joinRoom(roomId, player) {
  const room = getRoom(roomId);
  if (!room.players.has(player.id)) {
    room.players.set(player.id, { id: player.id, name: player.name, ready: false, connected: true });
    room.turnOrder.push(player.id);
  } else {
    const p = room.players.get(player.id);
    p.name = player.name || p.name;
    p.connected = true;
  }
  return room;
}

function leaveRoom(roomId, playerId) {
  const room = getRoom(roomId);
  if (!room.players.has(playerId)) return room;

  room.players.delete(playerId);
  const idx = room.turnOrder.indexOf(playerId);
  if (idx !== -1) {
    room.turnOrder.splice(idx, 1);
    if (room.turnIndex >= room.turnOrder.length) {
      room.turnIndex = 0;
    }
  }
  if (room.hostId === playerId) {
    room.hostId = room.turnOrder[0] || null;
  }
  if (room.players.size === 0) {
    rooms.delete(roomId);
    return null;
  }
  return room;
}

function startGame(roomId, requesterId) {
  const room = getRoom(roomId);
  // if (room.hostId !== requesterId) throw new Error('Only host can start the game');
  // if (room.players.size < 2) throw new Error('Need at least 2 players to start');
  room.phase = 'playing';
  room.turnIndex = 0;
  room.dice = [];
  return room;
}

function currentPlayerId(room) {
  return room.turnOrder[room.turnIndex];
}

function rollDice(roomId, playerId, _diceCount = 1, faces = 6) {
  const room = getRoom(roomId);
  if (room.phase !== 'playing') throw new Error('Game not in playing phase');
  if (currentPlayerId(room) !== playerId) throw new Error("Not this player's turn");
  const roll = 1 + Math.floor(Math.random() * faces);
  if (!Array.isArray(room.dice)) room.dice = [];
  room.dice.push(roll);
  return room;
}

  // rollDice() {
  //   this.blackDice = 1;
  //   this.blackDiceRolled = false;
  //   this.playSound();
  //   this.currentPlayer = this.gameBoard.players[this.gameBoard.currentTurn].name;

  //   if (this.turnDices.length === 4 || this.gameBoard.players.length === 0) {
  //     return;
  //   } else {
  //     let rollDice = Math.floor(Math.random() * (6 - 1 + 1) + 1);
  //     this.turnDices.push({ rollResult: rollDice });

  //     if (rollDice >= 4) {
  //       this.canParenMaren = true;
  //       this.canRoll = true;
  //     }
  //     if (rollDice < 4 || this.turnDices.length > 4) {
  //       this.canParenMaren = false;
  //       this.canRoll = false;
  //       setTimeout(() => {
  //         this.switchTurn();
  //       }, 2000);
  //     }
  //   }
  // }

function endTurn(roomId, playerId) {
  const room = getRoom(roomId);
  if (room.phase !== 'playing') throw new Error('Game not in playing phase');
  if (currentPlayerId(room) !== playerId) throw new Error("Not this player's turn");
  if (room.turnOrder.length === 0) return room;
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;
  room.dice = [];
  return room;
}

function snapshotRoom(room) {
  return {
    id: room.id,
    createdAt: room.createdAt,
    hostId: room.hostId,
    players: Array.from(room.players.values()),
    turnOrder: room.turnOrder.slice(),
    turnIndex: room.turnIndex,
    dice: room.dice.slice(),
    phase: room.phase,
  };
}

// Server setup
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

io.on('connection', (socket) => {
  // Expected to receive: { roomId, playerId, name, createIfMissing? }
  socket.on('joinRoom', (payload, ack) => {
    try {
      const { roomId, playerId, name, createIfMissing } = payload || {};
      if (!roomId || !playerId) throw new Error('roomId and playerId are required');

      if (!rooms.has(roomId)) {
        if (createIfMissing) {
          createRoom(roomId, { id: playerId, name: name || 'Host' });
        } else {
          throw new Error('Room does not exist');
        }
      }
      const room = joinRoom(roomId, { id: playerId, name: name || 'Player' });

      socket.data.roomId = roomId;
      socket.data.playerId = playerId;
      socket.join(roomId);

      io.to(roomId).emit('roomUpdated', snapshotRoom(room));
      ack && ack({ ok: true, room: snapshotRoom(room) });
    } catch (err) {
      const message = err && err.message ? err.message : 'Unknown error';
      ack && ack({ ok: false, error: message });
      socket.emit('errorMessage', message);
    }
  });

  socket.on('startGame', (ack) => {
    try {
      const { roomId, playerId } = socket.data;
      const room = startGame(roomId, playerId);
      io.to(roomId).emit('roomUpdated', snapshotRoom(room));
      ack && ack({ ok: true });
    } catch (err) {
      const message = err && err.message ? err.message : 'Unknown error';
      ack && ack({ ok: false, error: message });
      socket.emit('errorMessage', message);
    }
  });

  socket.on('rollDice', (payload, ack) => {
    try {
      const { faces = 6 } = payload || {};
      const { roomId, playerId } = socket.data;
      const room = rollDice(roomId, playerId, 1, faces);
      io.to(roomId).emit('roomUpdated', snapshotRoom(room));
      ack && ack({ ok: true, last: room.dice[room.dice.length - 1], dice: room.dice });
    } catch (err) {
      const message = err && err.message ? err.message : 'Unknown error';
      ack && ack({ ok: false, error: message });
      socket.emit('errorMessage', message);
    }
  });

  socket.on('endTurn', (ack) => {
    try {
      const { roomId, playerId } = socket.data;
      const room = endTurn(roomId, playerId);
      io.to(roomId).emit('roomUpdated', snapshotRoom(room));
      ack && ack({ ok: true });
    } catch (err) {
      const message = err && err.message ? err.message : 'Unknown error';
      ack && ack({ ok: false, error: message });
      socket.emit('errorMessage', message);
    }
  });

  socket.on('leaveRoom', (ack) => {
    try {
      const { roomId, playerId } = socket.data;
      const result = leaveRoom(roomId, playerId);
      if (result) {
        io.to(roomId).emit('roomUpdated', snapshotRoom(result));
      } else {
        // room deleted
        io.to(roomId).emit('roomDeleted');
      }
      socket.leave(roomId);
      ack && ack({ ok: true });
    } catch (err) {
      const message = err && err.message ? err.message : 'Unknown error';
      ack && ack({ ok: false, error: message });
      socket.emit('errorMessage', message);
    }
  });

  socket.on('disconnect', () => {
    const { roomId, playerId } = socket.data || {};
    if (!roomId || !playerId) return;
    try {
      const room = getRoom(roomId);
      const p = room.players.get(playerId);
      if (p) p.connected = false;
      io.to(roomId).emit('roomUpdated', snapshotRoom(room));
    } catch (_) {
      // room may not exist
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
