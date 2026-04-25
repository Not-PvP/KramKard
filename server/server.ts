import { Server } from "socket.io";
import { createServer } from "http";
import { createClient } from "@libsql/client";

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});
const io = new Server(httpServer, { cors: { origin: "*" } });

// ── Turso DB ──────────────────────────────────────────────────────
const db = createClient({
  url: process.env.TURSO_URL!,
  authToken: process.env.TURSO_TOKEN!,
});

async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      session_token TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0
    )
  `);
}

async function recordWin(token: string, name: string) {
  await db.execute({
    sql: `INSERT INTO leaderboard (session_token, name, wins, losses) VALUES (?, ?, 1, 0)
          ON CONFLICT(session_token) DO UPDATE SET wins = wins + 1, name = excluded.name`,
    args: [token, name],
  });
}

async function recordLoss(token: string, name: string) {
  await db.execute({
    sql: `INSERT INTO leaderboard (session_token, name, wins, losses) VALUES (?, ?, 0, 1)
          ON CONFLICT(session_token) DO UPDATE SET losses = losses + 1, name = excluded.name`,
    args: [token, name],
  });
}

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await db.execute(
    `SELECT session_token as sessionToken, name, wins, losses FROM leaderboard ORDER BY wins DESC, losses ASC LIMIT 20`
  );
  return res.rows as unknown as LeaderboardEntry[];
}

// ── Card types ────────────────────────────────────────────────────
export type CardId =
  | "slash" | "heavy_blow" | "weak_jab" | "heal" | "shield"
  | "gamble" | "cursed_blade" | "steal" | "divine_shield"
  | "poison_dart" | "double_strike" | "taunt" | "lucky_shot"
  | "vampire_bite" | "earthquake" | "mana_burn" | "time_warp"
  | "berserker" | "ice_spike" | "lightning_storm" | "blood_pact"
  | "reflect" | "meteor" | "ghost_step" | "regen";

const CARD_NAMES: Record<CardId, string> = {
  slash: "Slash", heavy_blow: "Heavy Blow", weak_jab: "Weak Jab",
  heal: "Mend Wounds", shield: "Iron Shield", gamble: "Gamble",
  cursed_blade: "Cursed Blade", steal: "Mirror Strike", divine_shield: "Divine Shield",
  poison_dart: "Poison Dart", double_strike: "Double Strike", taunt: "Taunt",
  lucky_shot: "Lucky Shot", vampire_bite: "Vampire Bite", earthquake: "Earthquake",
  mana_burn: "Mana Burn", time_warp: "Time Warp", berserker: "Berserker",
  ice_spike: "Ice Spike", lightning_storm: "Lightning Storm", blood_pact: "Blood Pact",
  reflect: "Reflect", meteor: "Meteor", ghost_step: "Ghost Step", regen: "Regen",
};

// ── Draw pool ─────────────────────────────────────────────────────
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
  "gamble",
  "double_strike",
  "steal",
  "divine_shield",
  "vampire_bite",
  "earthquake",
  "berserker",
  "ghost_step",
  "reflect",
  "cursed_blade",
  "lucky_shot",
  "blood_pact",
  "time_warp",
  "lightning_storm",
  "meteor",
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

// ── Types ─────────────────────────────────────────────────────────
interface Player {
  socketId: string;
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
  turn: string | null;
  log: string[];
  gameOver: boolean;
  winnerId: string | null;
  lastNarration: string;
}

interface LeaderboardEntry {
  sessionToken: string;
  name: string;
  wins: number;
  losses: number;
}

// ── Rooms ─────────────────────────────────────────────────────────
const rooms: Map<string, Room> = new Map();

function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { id: roomId, players: {}, turn: null, log: [], gameOver: false, winnerId: null, lastNarration: "" });
  }
  return rooms.get(roomId)!;
}

function addLog(room: Room, msg: string) {
  room.log.unshift(msg);
  if (room.log.length > 25) room.log.pop();
}

function broadcast(room: Room) {
  const tokens = Object.keys(room.players);
  tokens.forEach(myToken => {
    const p = room.players[myToken];
    if (!p.socketId) return;
    const socket = io.sockets.sockets.get(p.socketId);
    if (!socket) return;
    const strippedPlayers: Record<string, any> = {};
    tokens.forEach(t => {
      const pl = room.players[t];
      strippedPlayers[t] = { ...pl, hand: t === myToken ? pl.hand : pl.hand.map(() => "???") };
    });
    socket.emit("stateUpdate", {
      players: strippedPlayers,
      myToken,
      turn: room.turn,
      log: room.log,
      gameOver: room.gameOver,
      winnerId: room.winnerId,
      roomId: room.id,
      lastNarration: room.lastNarration,
    });
  });
}

// ── Game helpers ──────────────────────────────────────────────────
function getOpponentToken(room: Room, token: string): string | null {
  return Object.keys(room.players).find(x => x !== token) ?? null;
}

function replenishCard(player: Player) {
  player.hand.push(drawOne(player.hand));
}

function dealDamage(room: Room, actor: Player, target: Player, dmg: number, source: string): number {
  if (target.shield) {
    target.shield = false;
    addLog(room, `🛡 ${target.name}'s shield absorbed ${source}!`);
    return 0;
  }
  if (target.reflectActive) {
    target.reflectActive = false;
    actor.hp = Math.max(0, actor.hp - dmg);
    addLog(room, `🔮 ${target.name} REFLECTED ${dmg} damage back at ${actor.name}!`);
    return -1;
  }
  target.hp = Math.max(0, target.hp - dmg);
  return dmg;
}

function checkDeath(room: Room, actorToken: string, targetToken: string): boolean {
  const actor = room.players[actorToken];
  const target = room.players[targetToken];
  if (target && target.hp <= 0) { endGame(room, actorToken); return true; }
  if (actor && actor.hp <= 0)  { endGame(room, targetToken); return true; }
  return false;
}

function endGame(room: Room, winnerToken: string) {
  room.gameOver = true;
  room.winnerId = winnerToken;
  const winner = room.players[winnerToken];
  const loserToken = getOpponentToken(room, winnerToken);
  const loser = loserToken ? room.players[loserToken] : null;
  addLog(room, `★ ${winner.name} wins the battle!`);
  recordWin(winnerToken, winner.name).catch(console.error);
  if (loser) recordLoss(loserToken!, loser.name).catch(console.error);
}

function startTurn(room: Room, token: string) {
  const player = room.players[token];
  if (!player) return;
  if (player.skipNextTurn) {
    player.skipNextTurn = false;
    addLog(room, `😵 ${player.name} is stunned and skips their turn!`);
    const opp = getOpponentToken(room, token);
    if (opp) startTurn(room, opp);
    return;
  }
  if (player.regenStacks > 0) {
    const regen = player.regenStacks * 3;
    player.hp = Math.min(player.maxHp, player.hp + regen);
    addLog(room, `💚 ${player.name} regenerates ${regen} HP!`);
    player.regenStacks = Math.max(0, player.regenStacks - 1);
  }
  if (player.poisoned > 0) {
    player.hp = Math.max(0, player.hp - player.poisoned);
    addLog(room, `☠ ${player.name} takes ${player.poisoned} poison damage!`);
    player.poisoned = 0;
    const oppToken = getOpponentToken(room, token);
    if (player.hp <= 0 && oppToken) { endGame(room, oppToken); return; }
  }
  room.turn = token;
}

function resolveCard(room: Room, actorToken: string, cardId: CardId) {
  const actor = room.players[actorToken];
  const targetToken = getOpponentToken(room, actorToken);
  if (!targetToken) return;
  const target = room.players[targetToken];
  actor.lastCard = cardId;
  const idx = actor.hand.indexOf(cardId);
  if (idx !== -1) actor.hand.splice(idx, 1);

  let narration = "";

  switch (cardId) {
    case "slash": {
      const d = dealDamage(room, actor, target, 15, "slash");
      if (d > 0) { addLog(room, `⚔ ${actor.name} slashed ${target.name} for ${d} damage!`); narration = `${actor.name} draws their blade and slashes ${target.name} for ${d} damage!`; }
      break;
    }
    case "heavy_blow": {
      const d = dealDamage(room, actor, target, 22, "heavy blow");
      if (d > 0) { addLog(room, `💥 ${actor.name} landed a HEAVY BLOW for ${d} damage!`); narration = `${actor.name} winds up and SMASHES ${target.name} for ${d} damage! They're exhausted after...`; }
      actor.skipNextTurn = true;
      addLog(room, `😵 ${actor.name} is exhausted — skips next turn.`);
      break;
    }
    case "weak_jab": {
      const d = dealDamage(room, actor, target, 5, "weak jab");
      if (d > 0) { addLog(room, `👊 ${actor.name} weak jab... just 5 damage.`); narration = `${actor.name} throws a feeble jab at ${target.name}... dealing a whopping 5 damage. Embarrassing.`; }
      break;
    }
    case "heal": {
      const before = actor.hp;
      actor.hp = Math.min(actor.maxHp, actor.hp + 20);
      const gained = actor.hp - before;
      addLog(room, `♥ ${actor.name} healed ${gained} HP!`);
      narration = `${actor.name} calls upon the cosmos and mends their wounds, recovering ${gained} HP!`;
      break;
    }
    case "shield": {
      actor.shield = true;
      addLog(room, `🛡 ${actor.name} raised a shield — next hit blocked!`);
      narration = `${actor.name} conjures an iron barrier. The next attack will be completely nullified!`;
      break;
    }
    case "gamble": {
      if (Math.random() < 0.5) {
        const d = dealDamage(room, actor, target, 30, "gamble");
        if (d > 0) { addLog(room, `🎲 ${actor.name} GAMBLED AND WON — ${d} damage!`); narration = `${actor.name} rolled the dice... and WON! ${target.name} takes ${d} massive damage!`; }
      } else {
        actor.hp = Math.max(0, actor.hp - 15);
        addLog(room, `🎲 ${actor.name} gambled and LOST — 15 self-damage!`);
        narration = `${actor.name} rolled the dice... and LOST. The gods laugh as they take 15 damage to themselves!`;
      }
      break;
    }
    case "cursed_blade": {
      const d = dealDamage(room, actor, target, 40, "cursed blade");
      if (d > 0) { addLog(room, `🩸 CURSED BLADE — ${d} damage!`); narration = `${actor.name} unleashes the forbidden Cursed Blade, dealing ${d} devastating damage! But the curse binds them...`; }
      actor.skipNextTurn = true;
      addLog(room, `💀 The curse binds ${actor.name} — stunned next turn!`);
      break;
    }
    case "steal": {
      if (!target.lastCard || target.lastCard === "steal") {
        addLog(room, `🪞 ${actor.name} tried to mirror — nothing to copy!`);
        narration = `${actor.name} holds up the mirror... but ${target.name} has no recent moves to copy!`;
      } else {
        const copyId = target.lastCard;
        addLog(room, `🪞 ${actor.name} mirrors ${target.name}'s ${CARD_NAMES[copyId]}!`);
        narration = `${actor.name} channels the Mirror and reflects ${target.name}'s own ${CARD_NAMES[copyId]} back at them!`;
        actor.hand.unshift(copyId);
        resolveCard(room, actorToken, copyId);
        return;
      }
      break;
    }
    case "divine_shield": {
      actor.shield = true;
      actor.hp = Math.min(actor.maxHp, actor.hp + 10);
      addLog(room, `✦ ${actor.name} — divine shield + 10 HP!`);
      narration = `${actor.name} bathes in divine light! A shield forms and they recover 10 HP.`;
      break;
    }
    case "poison_dart": {
      const d = dealDamage(room, actor, target, 8, "poison dart");
      if (d > 0) { target.poisoned = 6; addLog(room, `☠ ${actor.name} poisoned ${target.name}! 8 + 6 poison next turn.`); narration = `${actor.name} fires a toxic dart! ${target.name} takes ${d} damage and is POISONED — 6 more next turn.`; }
      break;
    }
    case "double_strike": {
      let total = 0;
      for (let i = 0; i < 2; i++) {
        const d = dealDamage(room, actor, target, 12, `strike ${i+1}`);
        if (d > 0) total += d; else break;
      }
      if (total > 0) { addLog(room, `⚡ ${actor.name} struck TWICE for ${total} total!`); narration = `${actor.name} blurs into motion — striking ${target.name} TWICE for ${total} total damage!`; }
      break;
    }
    case "taunt": {
      target.taunted = true;
      addLog(room, `😤 ${actor.name} taunts ${target.name} — draw 1 fewer next turn!`);
      narration = `${actor.name} hurls insults at ${target.name}, rattling their concentration! They draw 1 fewer card next turn.`;
      break;
    }
    case "lucky_shot": {
      const dmg = Math.floor(Math.random() * 40) + 1;
      const d = dealDamage(room, actor, target, dmg, "lucky shot");
      if (d > 0) {
        addLog(room, `🍀 LUCKY SHOT — ${d} damage!${d >= 35 ? " INSANE!" : d <= 5 ? " Barely anything..." : ""}`);
        narration = d >= 35
          ? `${actor.name} fires blindly and somehow hits ${target.name} for ${d} INSANE damage! Blessed by the cosmos!`
          : d <= 5 ? `${actor.name} fires a lucky shot... and barely grazes ${target.name} for ${d} damage. Not so lucky.`
          : `${actor.name} fires a lucky shot! ${target.name} takes ${d} damage from pure chance.`;
      }
      break;
    }
    case "vampire_bite": {
      const d = dealDamage(room, actor, target, 14, "vampire bite");
      if (d > 0) {
        const stolen = Math.floor(d / 2);
        actor.hp = Math.min(actor.maxHp, actor.hp + stolen);
        addLog(room, `🧛 ${actor.name} drained ${d} HP and healed ${stolen}!`);
        narration = `${actor.name} sinks their fangs into ${target.name}, draining ${d} HP and restoring ${stolen} to themselves!`;
      }
      break;
    }
    case "earthquake": {
      const d = dealDamage(room, actor, target, 20, "earthquake");
      if (d > 0) {
        actor.hp = Math.max(0, actor.hp - 5);
        addLog(room, `🌍 EARTHQUAKE — ${d} to foe, 5 self-damage.`);
        narration = `${actor.name} stamps the cosmic ground — EARTHQUAKE! ${target.name} takes ${d} damage, but tremors deal 5 to ${actor.name} too!`;
      }
      break;
    }
    case "mana_burn": {
      if (target.hand.length > 0) {
        const ridx = Math.floor(Math.random() * target.hand.length);
        const burned = target.hand.splice(ridx, 1)[0] as CardId;
        addLog(room, `🔥 ${actor.name} burned ${target.name}'s ${CARD_NAMES[burned]}!`);
        const d = dealDamage(room, actor, target, 8, "mana burn");
        if (d > 0) addLog(room, `🔥 +${d} damage!`);
        narration = `${actor.name} ignites ${target.name}'s ${CARD_NAMES[burned]}, destroying it! The backlash deals ${d} damage.`;
      } else {
        addLog(room, `🔥 Mana Burn — ${target.name} has no cards!`);
        narration = `${actor.name} tries to burn a card... but ${target.name} has nothing to burn!`;
      }
      break;
    }
    case "time_warp": {
      actor.extraTurn = true;
      addLog(room, `⏳ ${actor.name} warps time — taking an extra turn!`);
      narration = `${actor.name} tears through the fabric of time itself — they get an EXTRA TURN!`;
      break;
    }
    case "berserker": {
      const ratio = 1 - actor.hp / actor.maxHp;
      const dmg = Math.floor(10 + ratio * 30);
      const d = dealDamage(room, actor, target, dmg, "berserker");
      if (d > 0) { addLog(room, `😡 BERSERKER — ${d} rage damage!`); narration = `${actor.name} BERSERKS with rage! The lower their HP, the harder they hit — dealing ${d} furious damage to ${target.name}!`; }
      break;
    }
    case "ice_spike": {
      const d = dealDamage(room, actor, target, 12, "ice spike");
      if (d > 0) {
        target.skipNextTurn = true;
        addLog(room, `🧊 ${actor.name} froze ${target.name}! ${d} DMG + stunned.`);
        narration = `${actor.name} launches a razor-sharp ice spike! ${target.name} takes ${d} damage and is FROZEN — skipping their next turn!`;
      }
      break;
    }
    case "lightning_storm": {
      const hits: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.65) {
          const d = dealDamage(room, actor, target, 10, "bolt");
          hits.push(d > 0 ? `${d} to ${target.name}` : "blocked!");
        } else {
          actor.hp = Math.max(0, actor.hp - 5);
          hits.push(`5 backfire on ${actor.name}`);
        }
      }
      addLog(room, `⚡ LIGHTNING STORM: ${hits.join(", ")}`);
      narration = `${actor.name} summons a LIGHTNING STORM! Three chaotic bolts — ${hits.join(", ")}!`;
      break;
    }
    case "blood_pact": {
      actor.hp = Math.max(0, actor.hp - 15);
      const d = dealDamage(room, actor, target, 35, "blood pact");
      if (d > 0) { addLog(room, `🩸 BLOOD PACT — −15 HP, dealt ${d}!`); narration = `${actor.name} seals a Blood Pact! They sacrifice 15 HP to unleash ${d} devastating damage on ${target.name}!`; }
      break;
    }
    case "reflect": {
      actor.reflectActive = true;
      addLog(room, `🔮 ${actor.name} set up REFLECT — next hit bounces back!`);
      narration = `${actor.name} conjures a mystic mirror. The next attack against them will be REFLECTED back!`;
      break;
    }
    case "meteor": {
      const d = dealDamage(room, actor, target, 50, "meteor");
      if (d > 0) {
        actor.skipNextTurn = true;
        addLog(room, `☄ METEOR — ${d} damage! Stunned after.`);
        narration = `${actor.name} calls down a METEOR! ${target.name} takes ${d} catastrophic damage! The effort stuns ${actor.name}...`;
      }
      break;
    }
    case "ghost_step": {
      actor.shield = true;
      const d = dealDamage(room, actor, target, 8, "ghost counter");
      addLog(room, `👻 ${actor.name} ghost-stepped — shield + ${d > 0 ? d + " counter" : "blocked"}!`);
      narration = `${actor.name} phases through reality! They gain a shield${d > 0 ? ` and counter-strike ${target.name} for ${d} damage` : ""}.`;
      break;
    }
    case "regen": {
      actor.regenStacks = Math.min(actor.regenStacks + 3, 5);
      addLog(room, `💚 ${actor.name} activated REGEN — ${actor.regenStacks * 3} HP/turn!`);
      narration = `${actor.name} channels cosmic energy, activating REGEN! They'll recover ${actor.regenStacks * 3} HP per turn for 3 turns.`;
      break;
    }
  }

  room.lastNarration = narration;
  if (checkDeath(room, actorToken, targetToken)) { broadcast(room); return; }
  replenishCard(actor);
  if (actor.extraTurn) {
    actor.extraTurn = false;
    addLog(room, `⏳ ${actor.name} takes an EXTRA TURN!`);
    startTurn(room, actorToken);
  } else {
    startTurn(room, targetToken);
  }
  broadcast(room);
}

// ── Socket events ─────────────────────────────────────────────────
io.on("connection", socket => {
  socket.on("joinRoom", ({ roomId, sessionToken, preferredName }: { roomId: string; sessionToken: string; preferredName: string }) => {
    const room = getRoom(roomId);
    const tokens = Object.keys(room.players);

    if (room.players[sessionToken]) {
      const player = room.players[sessionToken];
      player.socketId = socket.id;
      player.connected = true;
      socket.join(roomId);
      addLog(room, `${player.name} reconnected!`);
      broadcast(room);
      return;
    }

    if (tokens.length >= 2) { socket.emit("roomFull"); return; }

    const player: Player = {
      socketId: socket.id, sessionToken,
      name: preferredName.slice(0, 16),
      hp: 100, maxHp: 100,
      shield: false, reflectActive: false,
      poisoned: 0, regenStacks: 0,
      skipNextTurn: false, taunted: false, extraTurn: false,
      lastCard: null, hand: drawHand(5),
      rematchReady: false, connected: true,
    };

    room.players[sessionToken] = player;
    socket.join(roomId);
    addLog(room, `${player.name} entered the arena!`);

    if (Object.keys(room.players).length === 2) {
      room.gameOver = false;
      room.winnerId = null;
      room.turn = Object.keys(room.players)[0];
      addLog(room, "★ THE BATTLE BEGINS!");
    }
    broadcast(room);
  });

  socket.on("playCard", (cardId: CardId) => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      if (room.gameOver || room.turn !== token) return;
      if (!room.players[token].hand.includes(cardId)) return;
      resolveCard(room, token, cardId);
      return;
    }
  });

  socket.on("forfeit", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      if (room.gameOver) return;
      const oppToken = Object.keys(room.players).find(t => t !== token);
      addLog(room, `${room.players[token].name} forfeited!`);
      if (oppToken) endGame(room, oppToken);
      else room.gameOver = true;
      broadcast(room);
      return;
    }
  });

  socket.on("rematch", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token || !room.gameOver) continue;
      room.players[token].rematchReady = true;
      const tokens = Object.keys(room.players);
      if (tokens.length === 2 && tokens.every(t => room.players[t].rematchReady)) {
        tokens.forEach(t => {
          const p = room.players[t];
          p.hp = 100; p.maxHp = 100;
          p.shield = false; p.reflectActive = false;
          p.poisoned = 0; p.regenStacks = 0;
          p.skipNextTurn = false; p.taunted = false; p.extraTurn = false;
          p.lastCard = null; p.hand = drawHand(5); p.rematchReady = false;
        });
        room.gameOver = false; room.winnerId = null;
        room.log = []; room.lastNarration = "";
        room.turn = tokens[Math.floor(Math.random() * 2)];
        addLog(room, "★ REMATCH — FIGHT!");
      }
      broadcast(room);
      return;
    }
  });

  socket.on("getLeaderboard", async () => {
    socket.emit("leaderboard", await getLeaderboard());
  });

  socket.on("setName", (name: string) => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (token) { room.players[token].name = name.slice(0, 16); broadcast(room); return; }
    }
  });

  socket.on("disconnect", () => {
    for (const room of rooms.values()) {
      const token = Object.keys(room.players).find(t => room.players[t].socketId === socket.id);
      if (!token) continue;
      room.players[token].connected = false;
      addLog(room, `${room.players[token].name} disconnected — waiting for reconnect...`);
      broadcast(room);
      return;
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────
initDB().then(() => {
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  httpServer.listen(PORT, () => console.log(`✅ Server running on :${PORT}`));
}).catch(err => {
  console.error("Failed to init DB:", err);
  process.exit(1);
});