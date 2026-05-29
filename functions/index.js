const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'northamerica-northeast2' });

// ── SPANISH TILE BAG ──
const TILE_BAG = [
  ...Array(12).fill('A'),...Array(2).fill('B'),...Array(4).fill('C'),
  ...Array(5).fill('D'),...Array(12).fill('E'),...Array(1).fill('F'),
  ...Array(2).fill('G'),...Array(2).fill('H'),...Array(6).fill('I'),
  ...Array(1).fill('J'),...Array(4).fill('L'),...Array(2).fill('M'),
  ...Array(5).fill('N'),...Array(1).fill('Ñ'),...Array(9).fill('O'),
  ...Array(2).fill('P'),...Array(1).fill('Q'),...Array(5).fill('R'),
  ...Array(6).fill('S'),...Array(4).fill('T'),...Array(5).fill('U'),
  ...Array(1).fill('V'),...Array(1).fill('X'),...Array(1).fill('Y'),
  ...Array(1).fill('Z'),...Array(2).fill(' ')
];

const LETTER_VALUES = {
  A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,L:1,M:3,
  N:1,'Ñ':8,O:1,P:3,Q:5,R:1,S:1,T:1,U:1,V:4,X:8,Y:4,Z:10,' ':0
};

const PREMIUMS = {};
[['0-0','0-7','0-14','7-0','7-14','14-0','14-7','14-14']]
  .forEach(a=>a.forEach(k=>PREMIUMS[k]='tw'));
[['1-1','2-2','3-3','4-4','10-4','11-3','12-2','13-1',
  '1-13','2-12','3-11','4-10','10-10','11-11','12-12','13-13']]
  .forEach(a=>a.forEach(k=>PREMIUMS[k]='dw'));
[['5-1','5-5','5-9','5-13','9-1','9-5','9-9','9-13',
  '1-5','13-5','1-9','13-9']]
  .forEach(a=>a.forEach(k=>PREMIUMS[k]='tl'));
[['0-3','0-11','2-6','2-8','3-0','3-7','3-14','6-2','6-6',
  '6-8','6-12','7-3','7-11','8-2','8-6','8-8','8-12',
  '11-0','11-7','11-14','12-6','12-8','14-3','14-11']]
  .forEach(a=>a.forEach(k=>PREMIUMS[k]='dl'));

// ── HELPERS ──
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealTiles(bag, count) {
  const drawn = bag.slice(0, count);
  const remaining = bag.slice(count);
  return { drawn, remaining };
}

function traceWord(board, r, c, dr, dc) {
  while (board[`${r-dr}-${c-dc}`] !== undefined) { r -= dr; c -= dc; }
  const tiles = [];
  while (board[`${r}-${c}`] !== undefined) {
    tiles.push({ r, c, letter: board[`${r}-${c}`] });
    r += dr; c += dc;
  }
  return tiles;
}

function extractWords(board, newTiles) {
  const newKeys = new Set(newTiles.map(t => `${t.r}-${t.c}`));
  const words = [];
  const rows = newTiles.map(t => t.r);
  const cols = newTiles.map(t => t.c);
  const sameRow = rows.every(r => r === rows[0]);
  const sameCol = cols.every(c => c === cols[0]);

  const add = tiles => {
    if (tiles.length > 1 && tiles.some(t => newKeys.has(`${t.r}-${t.c}`)))
      words.push(tiles);
  };

  if (newTiles.length === 1) {
    const h = traceWord(board, rows[0], cols[0], 0, 1);
    const v = traceWord(board, rows[0], cols[0], 1, 0);
    if (h.length > 1) add(h);
    if (v.length > 1) add(v);
    if (!words.length) words.push(newTiles);
  } else if (sameRow) {
    add(traceWord(board, rows[0], cols[0], 0, 1));
    newTiles.forEach(t => add(traceWord(board, t.r, t.c, 1, 0)));
  } else if (sameCol) {
    add(traceWord(board, rows[0], cols[0], 1, 0));
    newTiles.forEach(t => add(traceWord(board, t.r, t.c, 0, 1)));
  }
  return words;
}

function calcScore(words, newKeys) {
  let total = 0;
  words.forEach(tiles => {
    let ws = 0, wm = 1;
    tiles.forEach(({ r, c, letter }) => {
      const key = `${r}-${c}`;
      const v = LETTER_VALUES[letter] || 0;
      const p = newKeys.has(key) ? PREMIUMS[key] : null;
      if (p === 'tl') ws += v * 3;
      else if (p === 'dl') ws += v * 2;
      else ws += v;
      if (p === 'tw') wm *= 3;
      else if (p === 'dw') wm *= 2;
    });
    total += ws * wm;
  });
  if (newKeys.size === 7) total += 50;
  return total;
}

function validatePlacement(board, newTiles) {
  if (!newTiles || newTiles.length === 0) return 'No tiles placed';

  const rows = newTiles.map(t => t.r);
  const cols = newTiles.map(t => t.c);
  const sameRow = rows.every(r => r === rows[0]);
  const sameCol = cols.every(c => c === cols[0]);

  if (!sameRow && !sameCol) return 'Tiles must be in a straight line';

  const allBoard = { ...board };
  newTiles.forEach(t => allBoard[`${t.r}-${t.c}`] = t.letter);

  if (sameRow) {
    const row = rows[0];
    const minC = Math.min(...cols), maxC = Math.max(...cols);
    for (let c = minC; c <= maxC; c++) {
      if (!allBoard[`${row}-${c}`]) return 'Tiles cannot have gaps';
    }
  } else {
    const col = cols[0];
    const minR = Math.min(...rows), maxR = Math.max(...rows);
    for (let r = minR; r <= maxR; r++) {
      if (!allBoard[`${r}-${col}`]) return 'Tiles cannot have gaps';
    }
  }

  const boardIsEmpty = Object.keys(board).length === 0;
  if (boardIsEmpty) {
    if (!newTiles.some(t => t.r === 7 && t.c === 7))
      return 'First move must cover the centre square';
  } else {
    const touches = newTiles.some(t =>
      board[`${t.r-1}-${t.c}`] || board[`${t.r+1}-${t.c}`] ||
      board[`${t.r}-${t.c-1}`] || board[`${t.r}-${t.c+1}`]
    );
    if (!touches) return 'Move must connect to existing tiles';
  }
  return null;
}

// ── CREATE GAME ──
exports.createGame = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

  const { opponentUid, language = 'es' } = request.data;
  const myUid = request.auth.uid;

  if (!opponentUid) throw new HttpsError('invalid-argument', 'opponentUid required');

  const bag = shuffle([...TILE_BAG]);
  const { drawn: rack1, remaining: bag1 } = dealTiles(bag, 7);
  const { drawn: rack2, remaining: bag2 } = dealTiles(bag1, 7);

  const gameRef = db.collection('games').doc();

  await gameRef.set({
    players: [myUid, opponentUid],
    currentTurn: myUid,
    scores: { [myUid]: 0, [opponentUid]: 0 },
    board: {},
    bag: bag2,
    language,
    status: 'active',
    consecutivePasses: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMove: null,
  });

  await gameRef.collection('racks').doc(myUid).set({ tiles: rack1 });
  await gameRef.collection('racks').doc(opponentUid).set({ tiles: rack2 });

  return { gameId: gameRef.id };
});

// ── SUBMIT MOVE ──
exports.submitMove = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

  const { gameId, tiles, action = 'play' } = request.data;
  const uid = request.auth.uid;

  return db.runTransaction(async tx => {
    const gameRef = db.collection('games').doc(gameId);
    const rackRef = gameRef.collection('racks').doc(uid);

    const [gameSnap, rackSnap] = await Promise.all([
      tx.get(gameRef),
      tx.get(rackRef)
    ]);

    if (!gameSnap.exists) throw new HttpsError('not-found', 'Game not found');

    const game = gameSnap.data();
    const rackData = rackSnap.data();

    if (game.status !== 'active') throw new HttpsError('failed-precondition', 'Game not active');
    if (game.currentTurn !== uid) throw new HttpsError('failed-precondition', 'Not your turn');

    // ── PASS ──
    if (action === 'pass') {
      const passes = (game.consecutivePasses || 0) + 1;
      const nextPlayer = game.players.find(p => p !== uid);
      tx.update(gameRef, {
        currentTurn: nextPlayer,
        consecutivePasses: passes,
        lastMove: { playerId: uid, type: 'pass',
          timestamp: admin.firestore.FieldValue.serverTimestamp() }
      });
      if (passes >= 4) tx.update(gameRef, { status: 'finished' });
      return { success: true };
    }

    // ── EXCHANGE ──
    if (action === 'exchange') {
      const { indices } = request.data;
      if (!indices || !indices.length) throw new HttpsError('invalid-argument', 'No tiles selected');
      if (indices.length > game.bag.length) throw new HttpsError('failed-precondition', 'Not enough tiles in bag');

      const rack = [...rackData.tiles];
      const returned = indices.map(i => rack[i]);
      const newBag = shuffle([...game.bag, ...returned]);
      const { drawn, remaining } = dealTiles(newBag, returned.length);
      indices.forEach((i, j) => rack[i] = drawn[j]);
      const nextPlayer = game.players.find(p => p !== uid);

      tx.update(gameRef, {
        bag: remaining,
        currentTurn: nextPlayer,
        consecutivePasses: 0,
        lastMove: { playerId: uid, type: 'exchange',
          timestamp: admin.firestore.FieldValue.serverTimestamp() }
      });
      tx.update(rackRef, { tiles: rack });
      return { success: true };
    }

    // ── PLAY ──
    if (!tiles || !tiles.length) throw new HttpsError('invalid-argument', 'No tiles provided');

    const rack = [...rackData.tiles];
    const usedIndices = [];
    for (const tile of tiles) {
      const idx = rack.findIndex((l, i) => l === tile.letter && !usedIndices.includes(i));
      if (idx === -1) throw new HttpsError('invalid-argument', `Tile ${tile.letter} not in rack`);
      usedIndices.push(idx);
    }

    const placementError = validatePlacement(game.board, tiles);
    if (placementError) throw new HttpsError('invalid-argument', placementError);

    const newBoard = { ...game.board };
    tiles.forEach(t => newBoard[`${t.r}-${t.c}`] = t.letter);

    const newKeys = new Set(tiles.map(t => `${t.r}-${t.c}`));
    const words = extractWords(newBoard, tiles);
    const score = calcScore(words, newKeys);

    const { drawn, remaining: newBag } = dealTiles(game.bag, tiles.length);
    const newRack = rack.filter((_, i) => !usedIndices.includes(i)).concat(drawn);

    const nextPlayer = game.players.find(p => p !== uid);
    const newScore = (game.scores[uid] || 0) + score;

    tx.update(gameRef, {
      board: newBoard,
      bag: newBag,
      [`scores.${uid}`]: newScore,
      currentTurn: nextPlayer,
      consecutivePasses: 0,
      lastMove: {
        playerId: uid,
        type: 'play',
        words: words.map(w => w.map(t => t.letter).join('')),
        score,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    });
    tx.update(rackRef, { tiles: newRack });

    const moveRef = gameRef.collection('moves').doc();
    tx.set(moveRef, {
      playerId: uid,
      type: 'play',
      tiles,
      words: words.map(w => w.map(t => t.letter).join('')),
      score,
      rackAfter: newRack,
      bagSize: newBag.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    if (newRack.length === 0 && newBag.length === 0) {
      tx.update(gameRef, { status: 'finished' });
    }

    return {
      success: true,
      score,
      words: words.map(w => w.map(t => t.letter).join('')),
      newTiles: drawn
    };
  });
});

// ── GET GAME STATE ──
exports.getGameState = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

  const { gameId } = request.data;
  const uid = request.auth.uid;

  const gameRef = db.collection('games').doc(gameId);
  const [gameSnap, rackSnap] = await Promise.all([
    gameRef.get(),
    gameRef.collection('racks').doc(uid).get()
  ]);

  if (!gameSnap.exists) throw new HttpsError('not-found', 'Game not found');

  const game = gameSnap.data();
  if (!game.players.includes(uid)) throw new HttpsError('permission-denied', 'Not a player in this game');

  return {
    gameId,
    board: game.board,
    scores: game.scores,
    currentTurn: game.currentTurn,
    bagSize: game.bag.length,
    status: game.status,
    lastMove: game.lastMove,
    myRack: rackSnap.exists ? rackSnap.data().tiles : [],
    isMyTurn: game.currentTurn === uid,
  };
});

// ── SEND PUSH NOTIFICATION ──
async function sendPushToUser(uid, title, body) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return;
    const token = userDoc.data().fcmToken;
    if (!token) return;
    await admin.messaging().send({
      token,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: 'https://scr.reilly.mx/icon-192.png',
          badge: 'https://scr.reilly.mx/icon-192.png',
        },
        fcmOptions: { link: 'https://scr.reilly.mx' }
      }
    });
    console.log('Push sent to', uid);
  } catch(err) {
    console.log('Push failed:', err.message);
  }
}
