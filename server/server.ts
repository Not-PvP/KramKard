import { Server } from "socket.io";
import { createServer } from "http";
import { createClient } from "@libsql/client";

// ─── Database setup (Turso) ───────────────────────────────────────────────────

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS players (
      sessionToken TEXT PRIMARY KEY,
      name         TEXT    NOT NULL,
      wins         INTEGER NOT NULL DEFAULT 0,
      losses       INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS matches (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      winnerToken TEXT    NOT NULL,
      loserToken  TEXT    NOT NULL,
      winnerName  TEXT    NOT NULL,
      loserName   TEXT    NOT NULL,
      playedAt    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log("✅ DB initialized");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardId =
  | "slash" | "heavy_blow" | "weak_jab" | "heal" | "shield"
  | "gamble" | "cursed_blade" | "steal" | "divine_shield"
  | "poison_dart" | "double_strike" | "taunt" | "lucky_shot"
  | "vampire_bite" | "earthquake" | "mana_burn" | "time_warp"
  | "berserker" | "ice_spike" | "lightning_storm" | "blood_pact"
  | "reflect" | "meteor" | "ghost_step" | "regen";

export interface CardDef {
  id: CardId;
  name: string;
  rarity: "common" | "uncommon" | "rare" | "cursed" | "legendary";
}

export const CARD_DEFS: Record<CardId, CardDef> = {
  slash:           { id: "slash",           name: "Slash",           rarity: "common" },
  heavy_blow:      { id: "heavy_blow",      name: "Heavy Blow",      rarity: "uncommon" },
  weak_jab:        { id: "weak_jab",        name: "Weak Jab",        rarity: "common" },
  heal:            { id: "heal",            name: "Mend Wounds",     rarity: "uncommon" },
  shield:          { id: "shield",          name: "Iron Shield",     rarity: "uncommon" },
  gamble:          { id: "gamble",          name: "Gamble",          rarity: "rare" },
  cursed_blade:    { id: "cursed_blade",    name: "Cursed Blade",    rarity: "cursed" },
  steal:           { id: "steal",           name: "Mirror Strike",   rarity: "rare" },
  divine_shield:   { id: "divine_shield",   name: "Divine Shield",   rarity: "rare" },
  poison_dart:     { id: "poison_dart",     name: "Poison Dart",     rarity: "uncommon" },
  double_strike:   { id: "double_strike",   name: "Double Strike",   rarity: "rare" },
  taunt:           { id: "taunt",           name: "Taunt",           rarity: "uncommon" },
  lucky_shot:      { id: "lucky_shot",      name: "Lucky Shot",      rarity: "cursed" },
  vampire_bite:    { id: "vampire_bite",    name: "Vampire Bite",    rarity: "rare" },
  earthquake:      { id: "earthquake",      name: "Earthquake",      rarity: "rare" },
  mana_burn:       { id: "mana_burn",       name: "Mana Burn",       rarity: "uncommon" },
  time_warp:       { id: "time_warp",       name: "Time Warp",       rarity: "legendary" },
  berserker:       { id: "berserker",       name: "Berserker",       rarity: "rare" },
  ice_spike:       { id: "ice_spike",       name: "Ice Spike",       rarity: "uncommon" },
  lightning_storm: { id: "lightning_storm", name: "Lightning Storm", rarity: "legendary" },
  blood_pact:      { id: "blood_pact",      name: "Blood Pact",      rarity: "cursed" },
  reflect:         { id: "reflect",         name: "Reflect",         rarity: "rare" },
  meteor:          { id: "meteor",          name: "Meteor",          rarity: "legendary" },
  ghost_step:      { id: "ghost_step",      name: "Ghost Step",      rarity: "rare" },
  regen:           { id: "regen",           name: "Regen",           rarity: "uncommon" },
};

// ─── Draw pool ────────────────────────────────────────────────────────────────

const DRAW_POOL: CardId[] = [
  "slash","slash","slash","slash",
  "weak_jab","weak_jab","weak_jab",
  "heavy_blow","heavy_blow",
  "heal","heal","heal",
  "shield","shield",
  "poison_dart","poison_dart",
  "taunt","taunt",
  "mana_burn","mana_burn",
  "ice_spike","ice_spike",
  "regen","regen",
  "gamble","double_strike","steal","divine_shield",
  "vampire_bite","earthquake","berserker","ghost_step","reflect",
  "cursed_blade","lucky_shot","blood_pact",
  "time_warp","lightning_storm","meteor",
];

function drawOne(exclude: CardId[] = []): CardId {
  const pool = DRAW_POOL.filter(c => !exclude.includes(c));
  return pool[Math.floor(Math.random() * pool.length)];
}

function drawHand(count = 5): CardId[] {
  const hand: CardId[] = [];
  for (let i = 0; i < count; i++) hand.push(drawOne(hand));
  return hand;
}

// ─── Player & Room types ──────────────────────────────────────────────────────

interface Player {
  id: string;
  sessionToken: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: boolean;
  reflectActive: boolean;
  poisoned: number;
  regenStacks: number;
  skipNextTurn: boolean;
  taunted: boolean;
  extraTurn: boolean;
  lastCard: CardId | null;
  hand: CardId[];
  rematchReady: boolean;
  connected: boolean;
}

interface Room {
  id: string;
  players: Record<string, Player>;
  socketToSession: Record<string, string>;
  turn: string | null;
  log: string[];
  gameOver: boolean;
  winnerId: string | null;
}

const rooms = new Map<string, Room>();
const sessionToRoom = new Map<string, string>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addLog(room: Room, msg: string) {
  room.log.unshift(msg);
  if (room.log.length > 30) room.log.pop();
}

function getPlayers(room: Room): Player[] {
  return Object.values(room.players);
}

function getOpponent(room: Room, sessionToken: string): Player | undefined {
  return getPlayers(room).find(p => p.sessionToken !== sessionToken);
}

function replenishCard(player: Player) {
  if (player.taunted) { player.taunted = false; return; }
  player.hand.push(drawOne(player.hand));
}

function broadcastRoom(room: Room) {
  const tokens = Object.keys(room.players);
  tokens.forEach(myToken => {
    const player = room.players[myToken];
    const socket = io.sockets.sockets.get(player.id);
    if (!socket || !player.connected) return;
    const sanitisedPlayers: Record<string, any> = {};
    tokens.forEach(t => {
      const p = room.players[t];
      sanitisedPlayers[t] = { ...p, hand: t === myToken ? p.hand : p.hand.map(() => "???") };
    });
    socket.emit("stateUpdate", {
      players: sanitisedPlayers, myToken,
      turn: room.turn, log: room.log,
      gameOver: room.gameOver, winnerId: room.winnerId, roomId: room.id,
    });
  });
}

// ─── DB helpers (async) ───────────────────────────────────────────────────────

async function upsertWin(sessionToken: string, name: string) {
  await db.execute({
    sql: `INSERT INTO players (sessionToken, name, wins, losses) VALUES (?, ?, 1, 0)
          ON CONFLICT(sessionToken) DO UPDATE SET wins = wins + 1, name = excluded.name`,
    args: [sessionToken, name],
  });
}

async function upsertLoss(sessionToken: string, name: string) {
  await db.execute({
    sql: `INSERT INTO players (sessionToken, name, wins, losses) VALUES (?, ?, 0, 1)
          ON CONFLICT(sessionToken) DO UPDATE SET losses = losses + 1, name = excluded.name`,
    args: [sessionToken, name],
  });
}

async function insertMatch(winnerToken: string, loserToken: string, winnerName: string, loserName: string) {
  await db.execute({
    sql: `INSERT INTO matches (winnerToken, loserToken, winnerName, loserName) VALUES (?, ?, ?, ?)`,
    args: [winnerToken, loserToken, winnerName, loserName],
  });
}

async function findPlayer(sessionToken: string): Promise<{ name: string } | null> {
  const res = await db.execute({ sql: `SELECT * FROM players WHERE sessionToken = ?`, args: [sessionToken] });
  return (res.rows[0] as any) ?? null;
}

async function upsertName(sessionToken: string, name: string) {
  await db.execute({
    sql: `INSERT INTO players (sessionToken, name, wins, losses) VALUES (?, ?, 0, 0)
          ON CONFLICT(sessionToken) DO UPDATE SET name = excluded.name`,
    args: [sessionToken, name],
  });
}

async function getLeaderboard() {
  const res = await db.execute(`SELECT * FROM players ORDER BY wins DESC LIMIT 20`);
  return res.rows;
}

// ─── Game logic ───────────────────────────────────────────────────────────────

async function endGame(room: Room, loserToken: string) {
  room.gameOver = true;
  const winnerToken = Object.keys(room.players).find(t => t !== loserToken)!;
  room.winnerId = winnerToken;
  const winner = room.players[winnerToken];
  const loser = room.players[loserToken];
  addLog(room, `★ ${winner.name} wins the battle!`);
  try {
    await upsertWin(winnerToken, winner.name);
    await upsertLoss(loserToken, loser.name);
    await insertMatch(winnerToken, loserToken, winner.name, loser.name);
  } catch (e) { console.error("DB error:", e); }
}

async function checkDeath(room: Room, actorToken: string, targetToken: string): Promise<boolean> {
  const target = room.players[targetToken];
  const actor = room.players[actorToken];
  if (target.hp <= 0) { await endGame(room, targetToken); return true; }
  if (actor.hp <= 0)  { await endGame(room, actorToken);  return true; }
  return false;
}

function dealDamage(actor: Player, target: Player, dmg: number, source: string, room: Room): number {
  if (target.shield) {
    target.shield = false;
    addLog(room, `🛡 ${target.name}'s shield absorbed ${source}!`);
    return 0;
  }
  if (target.reflectActive) {
    target.reflectActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    addLog(room, `🔮 ${target.name} reflected ${dmg} damage back to ${actor.name}!`);
    return -dmg;
  }
  target.hp = Math.max(0, target.hp - dmg);
  return dmg;
}

function startTurn(room: Room, token: string) {
  const player = room.players[token];
  const opponent = getOpponent(room, token);
  if (!opponent) return;
  if (player.skipNextTurn) {
    player.skipNextTurn = false;
    addLog(room, `😵 ${player.name} is stunned — skips their turn!`);
    startTurn(room, opponent.sessionToken);
    return;
  }
  if (player.regenStacks > 0) {
    const heal = player.regenStacks * 3;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    addLog(room, `💚 ${player.name} regenerates ${heal} HP!`);
    player.regenStacks = Math.max(0, player.regenStacks - 1);
  }
  if (player.poisoned > 0) {
    player.hp = Math.max(0, player.hp - player.poisoned);
    addLog(room, `☠ ${player.name} takes ${player.poisoned} poison damage!`);
    player.poisoned = 0;
    if (player.hp <= 0) { endGame(room, token); return; }
  }
  room.turn = token;
}

async function resolveCard(room: Room, actorToken: string, cardId: CardId) {
  const actor = room.players[actorToken];
  const target = getOpponent(room, actorToken);
  if (!target) return;
  actor.lastCard = cardId;
  const idx = actor.hand.indexOf(cardId);
  if (idx !== -1) actor.hand.splice(idx, 1);

  switch (cardId) {
    case "slash": { const d = dealDamage(actor, target, 15, "slash", room); if (d > 0) addLog(room, `⚔ ${actor.name} slashed ${target.name} for ${d} damage!`); break; }
    case "heavy_blow": { const d = dealDamage(actor, target, 22, "heavy blow", room); if (d > 0) addLog(room, `💥 ${actor.name} landed a HEAVY BLOW for ${d} damage!`); actor.skipNextTurn = true; addLog(room, `😵 ${actor.name} is exhausted — skips next turn.`); break; }
    case "weak_jab": { const d = dealDamage(actor, target, 5, "weak jab", room); if (d > 0) addLog(room, `👊 ${actor.name} threw a weak jab for ${d} damage.`); break; }
    case "heal": { const before = actor.hp; actor.hp = Math.min(actor.maxHp, actor.hp + 20); addLog(room, `♥ ${actor.name} healed for ${actor.hp - before} HP!`); break; }
    case "shield": { actor.shield = true; addLog(room, `🛡 ${actor.name} raised a shield!`); break; }
    case "gamble": { if (Math.random() < 0.5) { const d = dealDamage(actor, target, 30, "gamble", room); if (d > 0) addLog(room, `🎲 ${actor.name} GAMBLED AND WON — ${d} damage!`); } else { actor.hp = Math.max(0, actor.hp - 15); addLog(room, `🎲 ${actor.name} gambled and LOST — took 15 self-damage!`); } break; }
    case "cursed_blade": { const d = dealDamage(actor, target, 40, "cursed blade", room); if (d > 0) addLog(room, `🩸 ${actor.name} unleashed CURSED BLADE — ${d} damage!`); actor.skipNextTurn = true; addLog(room, `💀 The curse binds ${actor.name} — stunned!`); break; }
    case "steal": { if (!target.lastCard || target.lastCard === "steal") { addLog(room, `🪞 Nothing to mirror!`); } else { addLog(room, `🪞 ${actor.name} mirrors ${CARD_DEFS[target.lastCard].name}!`); actor.hand.unshift(target.lastCard); await resolveCard(room, actorToken, target.lastCard); return; } break; }
    case "divine_shield": { actor.shield = true; actor.hp = Math.min(actor.maxHp, actor.hp + 10); addLog(room, `✦ ${actor.name} calls divine protection — shield + 10 HP!`); break; }
    case "poison_dart": { const d = dealDamage(actor, target, 8, "poison dart", room); if (d > 0) { target.poisoned = 6; addLog(room, `☠ ${actor.name} poisoned ${target.name}! 8 DMG + 6 poison.`); } break; }
    case "double_strike": { let total = 0; for (let i = 0; i < 2; i++) { const d = dealDamage(actor, target, 12, `strike ${i+1}`, room); if (d > 0) total += d; else break; } if (total > 0) addLog(room, `⚡ ${actor.name} struck TWICE for ${total} total!`); break; }
    case "taunt": { target.taunted = true; addLog(room, `😤 ${actor.name} taunts ${target.name} — skip next draw!`); break; }
    case "lucky_shot": { const dmg = Math.floor(Math.random() * 40) + 1; const d = dealDamage(actor, target, dmg, "lucky shot", room); if (d > 0) addLog(room, `🍀 LUCKY SHOT hits for ${d}!${d >= 35 ? " INSANE!" : d <= 5 ? " Barely a scratch..." : ""}`); break; }
    case "vampire_bite": { const d = dealDamage(actor, target, 14, "vampire bite", room); if (d > 0) { const ls = Math.floor(d/2); actor.hp = Math.min(actor.maxHp, actor.hp + ls); addLog(room, `🧛 ${actor.name} drained ${d} HP and healed ${ls}!`); } break; }
    case "earthquake": { const d = dealDamage(actor, target, 20, "earthquake", room); if (d > 0) { actor.hp = Math.max(0, actor.hp - 5); addLog(room, `🌍 EARTHQUAKE! ${d} to foe, 5 self-damage.`); } break; }
    case "mana_burn": { if (target.hand.length > 0) { const bi = Math.floor(Math.random() * target.hand.length); const burned = target.hand.splice(bi, 1)[0]; addLog(room, `🔥 ${actor.name} burned ${CARD_DEFS[burned]?.name ?? "card"}!`); const d = dealDamage(actor, target, 8, "mana burn", room); if (d > 0) addLog(room, `🔥 ...and dealt ${d} damage!`); } else { addLog(room, `🔥 Mana Burn failed!`); } break; }
    case "time_warp": { actor.extraTurn = true; addLog(room, `⏳ ${actor.name} bends time — extra turn!`); break; }
    case "berserker": { const ratio = 1 - actor.hp / actor.maxHp; const dmg = Math.floor(10 + ratio * 30); const d = dealDamage(actor, target, dmg, "berserker", room); if (d > 0) addLog(room, `😡 ${actor.name} BERSERKS for ${d}!`); break; }
    case "ice_spike": { const d = dealDamage(actor, target, 12, "ice spike", room); if (d > 0) { target.skipNextTurn = true; addLog(room, `🧊 ICE SPIKE — ${d} DMG + stun!`); } break; }
    case "lightning_storm": { const hits: string[] = []; for (let i = 0; i < 3; i++) { if (Math.random() < 0.65) { const d = dealDamage(actor, target, 10, "lightning", room); hits.push(d > 0 ? `${d} to foe` : "blocked!"); } else { actor.hp = Math.max(0, actor.hp - 5); hits.push(`5 backfire!`); } } addLog(room, `⚡ LIGHTNING STORM: ${hits.join(", ")}`); break; }
    case "blood_pact": { actor.hp = Math.max(0, actor.hp - 15); const d = dealDamage(actor, target, 35, "blood pact", room); if (d > 0) addLog(room, `🩸 BLOOD PACT — sacrificed 15, dealt ${d}!`); break; }
    case "reflect": { actor.reflectActive = true; addLog(room, `🔮 ${actor.name} set REFLECT!`); break; }
    case "meteor": { const d = dealDamage(actor, target, 50, "meteor", room); if (d > 0) { actor.skipNextTurn = true; addLog(room, `☄ METEOR — ${d} damage! Stunned after.`); } break; }
    case "ghost_step": { actor.shield = true; const d = dealDamage(actor, target, 8, "ghost counter", room); addLog(room, `👻 Ghost step — shield + ${d > 0 ? d + " counter" : "blocked"}!`); break; }
    case "regen": { actor.regenStacks = Math.min(actor.regenStacks + 3, 5); addLog(room, `💚 REGEN — heals ${actor.regenStacks * 3}/turn!`); break; }
  }

  if (await checkDeath(room, actorToken, target.sessionToken)) { broadcastRoom(room); return; }
  replenishCard(actor);
  if (actor.extraTurn) { actor.extraTurn = false; addLog(room, `⏳ ${actor.name} takes an EXTRA TURN!`); startTurn(room, actorToken); }
  else { startTurn(room, target.sessionToken); }
  broadcastRoom(room);
}

// ─── HTTP + Socket.IO server ──────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200);
    res.end("OK");
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

const NAMES = ["Kram","Zara","Vex","Liora","Donn","Sable","Ryke","Mira","Cael","Nyra"];
let nameIdx = 0;

function findSessionBySocket(socketId: string): string | undefined {
  for (const room of rooms.values()) {
    if (room.socketToSession[socketId]) return room.socketToSession[socketId];
  }
  return undefined;
}

io.on("connection", socket => {

  socket.on("joinRoom", async ({ roomId, sessionToken, preferredName }: { roomId: string; sessionToken: string; preferredName?: string }) => {
    // Reconnect existing session
    const existingRoomId = sessionToRoom.get(sessionToken);
    if (existingRoomId) {
      const room = rooms.get(existingRoomId);
      if (room && room.players[sessionToken]) {
        const player = room.players[sessionToken];
        room.socketToSession[socket.id] = sessionToken;
        delete room.socketToSession[player.id];
        player.id = socket.id;
        player.connected = true;
        socket.join(existingRoomId);
        addLog(room, `🔄 ${player.name} reconnected!`);
        broadcastRoom(room);
        return;
      }
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { id: roomId, players: {}, socketToSession: {}, turn: null, log: [], gameOver: false, winnerId: null };
      rooms.set(roomId, room);
    }
    if (Object.keys(room.players).length >= 2) { socket.emit("roomFull"); return; }

    let playerName = preferredName ?? NAMES[nameIdx++ % NAMES.length];
    try {
      const dbPlayer = await findPlayer(sessionToken);
      if (dbPlayer) playerName = dbPlayer.name;
    } catch {}

    const player: Player = {
      id: socket.id, sessionToken, name: playerName,
      hp: 100, maxHp: 100, shield: false, reflectActive: false,
      poisoned: 0, regenStacks: 0, skipNextTurn: false, taunted: false,
      extraTurn: false, lastCard: null, hand: drawHand(5), rematchReady: false, connected: true,
    };

    room.players[sessionToken] = player;
    room.socketToSession[socket.id] = sessionToken;
    sessionToRoom.set(sessionToken, roomId);
    socket.join(roomId);
    addLog(room, `${playerName} entered the arena!`);
    if (Object.keys(room.players).length === 2) {
      room.gameOver = false; room.winnerId = null;
      room.turn = Object.keys(room.players)[0];
      addLog(room, "★ THE BATTLE BEGINS!");
    }
    broadcastRoom(room);
  });

socket.on("playCard", (cardId: CardId) => {
    const sessionToken = findSessionBySocket(socket.id);
    console.log("playCard received:", cardId, "socketId:", socket.id, "sessionToken:", sessionToken);
    if (!sessionToken) { console.log("BLOCKED: no sessionToken"); return; }
    const roomId = sessionToRoom.get(sessionToken);
    if (!roomId) { console.log("BLOCKED: no roomId"); return; }
    const room = rooms.get(roomId);
    console.log("turn:", room?.turn, "sessionToken:", sessionToken, "match:", room?.turn === sessionToken);
    if (!room || room.gameOver || room.turn !== sessionToken) { console.log("BLOCKED: not your turn or game over"); return; }
    const player = room.players[sessionToken];
    if (!player || !player.hand.includes(cardId)) { console.log("BLOCKED: card not in hand"); return; }
    resolveCard(room, sessionToken, cardId);
  });

  socket.on("rematch", async () => {
    const sessionToken = findSessionBySocket(socket.id);
    if (!sessionToken) return;
    const roomId = sessionToRoom.get(sessionToken);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.gameOver) return;
    room.players[sessionToken].rematchReady = true;
    addLog(room, `${room.players[sessionToken].name} wants a rematch!`);
    if (Object.values(room.players).every(p => p.rematchReady)) {
      Object.values(room.players).forEach(p => {
        p.hp = 100; p.maxHp = 100; p.shield = false; p.reflectActive = false;
        p.poisoned = 0; p.regenStacks = 0; p.skipNextTurn = false;
        p.taunted = false; p.extraTurn = false; p.lastCard = null;
        p.hand = drawHand(5); p.rematchReady = false;
      });
      room.log = []; room.gameOver = false; room.winnerId = null;
      room.turn = Object.keys(room.players)[0];
      addLog(room, "★ REMATCH BEGINS!");
    }
    broadcastRoom(room);
  });

  socket.on("setName", async (name: string) => {
    const sessionToken = findSessionBySocket(socket.id);
    if (!sessionToken) return;
    const roomId = sessionToRoom.get(sessionToken);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players[sessionToken];
    if (!player) return;
    player.name = name.slice(0, 16);
    try { await upsertName(sessionToken, player.name); } catch {}
    broadcastRoom(room);
  });

  socket.on("getLeaderboard", async () => {
    try { socket.emit("leaderboard", await getLeaderboard()); }
    catch { socket.emit("leaderboard", []); }
  });

  socket.on("disconnect", () => {
    const sessionToken = findSessionBySocket(socket.id);
    if (!sessionToken) return;
    const roomId = sessionToRoom.get(sessionToken);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players[sessionToken];
    if (!player) return;
    player.connected = false;
    addLog(room, `⚠ ${player.name} disconnected — waiting for reconnect...`);
    broadcastRoom(room);
    setTimeout(() => {
      const p = room?.players[sessionToken];
      if (p && !p.connected) {
        delete room.players[sessionToken];
        delete room.socketToSession[socket.id];
        sessionToRoom.delete(sessionToken);
        if (Object.keys(room.players).length === 0) { rooms.delete(roomId); }
        else { addLog(room, `${p.name} left the arena.`); room.gameOver = true; broadcastRoom(room); }
      }
    }, 5 * 60 * 1000);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3000", 10);
initDb().then(() => {
  httpServer.listen(PORT, () => console.log(`🃏 Kram Kard server running on :${PORT}`));
}).catch(err => {
  console.error("Failed to init DB:", err);
  process.exit(1);
});