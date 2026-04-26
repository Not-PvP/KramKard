import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { CARD_DEFS, RARITY_COLORS, RARITY_LABELS, type CardId, type Rarity, type CardDef } from "./cardDefs";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlayerState {
  id: string;
  sessionToken: string;
  name: string;
  hp: number;
  maxHp: number;
  shield: boolean;
  reflectActive: boolean;
  poisoned: number;
  regenStacks: number;
  skipTurns: number;
  skipNextTurn: boolean;
  taunted: boolean;
  extraTurn: boolean;
  counterStanceActive: boolean;
  manaSurgeActive: boolean;
  plagueStacks: number;
  stunsSuffered: number;
  lastCard: CardId | null;
  hand: (CardId | "???")[];
  rematchReady: boolean;
  connected: boolean;
}

interface GameState {
  players: Record<string, PlayerState>;
  myToken: string;
  turn: string | null;
  log: string[];
  gameOver: boolean;
  winnerId: string | null;
  roomId: string;
  lastNarration: string;
}

interface LeaderboardEntry {
  sessionToken: string;
  name: string;
  wins: number;
  losses: number;
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function getOrCreateSession(): string {
  let token = localStorage.getItem("kramkard_session");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("kramkard_session", token);
  }
  return token;
}

function getRoomId(): string {
  const params = new URLSearchParams(window.location.search);
  let room = params.get("room");
  if (!room) {
    room = Math.random().toString(36).slice(2, 8).toUpperCase();
    const url = new URL(window.location.href);
    url.searchParams.set("room", room);
    window.history.replaceState({}, "", url.toString());
  }
  return room;
}

// ─── Starfield ────────────────────────────────────────────────────────────────

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 140 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.25 + 0.04,
      flicker: Math.random() * Math.PI * 2,
    }));
    const pixels = Array.from({ length: 25 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      size: Math.floor(Math.random() * 3) + 1,
      color: ["#a55eea", "#45aaf2", "#fc5c65", "#f9ca24"][Math.floor(Math.random() * 4)],
      speed: Math.random() * 0.12 + 0.02,
    }));
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.flicker += 0.018;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(s.flicker) * 0.3})`;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), Math.ceil(s.r), Math.ceil(s.r));
        s.y += s.speed;
        if (s.y > canvas.height) { s.y = 0; s.x = Math.random() * canvas.width; }
      });
      pixels.forEach(p => {
        ctx.fillStyle = p.color + "88";
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size * 2, p.size * 2);
        p.y += p.speed;
        if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}

// ─── HP Bar ───────────────────────────────────────────────────────────────────

function HPBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 50 ? "#26de81" : pct > 25 ? "#f9ca24" : "#fc5c65";
  const segments = 20;
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: segments }).map((_, i) => {
        const filled = i < Math.round((pct / 100) * segments);
        return <div key={i} style={{ width: 8, height: 12, background: filled ? color : "#111", border: `1px solid ${filled ? color : "#222"}`, boxShadow: filled ? `0 0 3px ${color}88` : "none" }} />;
      })}
      <span style={{ marginLeft: 6, fontSize: 10, color: "#ccc" }}>{hp}</span>
    </div>
  );
}

// ─── Battle card ──────────────────────────────────────────────────────────────

function BattleCard({ player, isActive, isMine }: { player: PlayerState; isActive: boolean; isMine: boolean }) {
  const borderColor = isActive ? "#f9ca24" : isMine ? "#45aaf2" : "#a55eea";
  return (
    <div style={{ position: "relative", background: "linear-gradient(135deg, #0a0a16 0%, #080810 100%)", border: `2px solid ${borderColor}`, padding: "14px 18px", minWidth: 240, fontFamily: "'Press Start 2P', monospace", boxShadow: isActive ? `0 0 0 1px ${borderColor}44, 0 0 20px ${borderColor}33` : `0 0 0 1px ${borderColor}22`, transform: isActive ? "scale(1.02)" : "scale(1)", transition: "all 0.2s ease", opacity: player.connected ? 1 : 0.5 }}>
      {[["-2px","-2px","top","left"],["-2px","-2px","top","right"],["-2px","-2px","bottom","left"],["-2px","-2px","bottom","right"]].map(([,, v, h], i) => (
        <div key={i} style={{ position: "absolute", [v]: -2, [h]: -2, width: 6, height: 6, background: borderColor, boxShadow: `0 0 5px ${borderColor}` }} />
      ))}
      {isActive && <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 7, color: "#f9ca24", animation: "blink 0.8s step-end infinite", whiteSpace: "nowrap" }}>▼ TURN ▼</div>}
      {!player.connected && <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontSize: 6, color: "#fc5c65", animation: "blink 1s step-end infinite", whiteSpace: "nowrap" }}>⚠ DISCONNECTED</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 7, color: isMine ? "#45aaf2" : "#a55eea", letterSpacing: 1 }}>{isMine ? "► YOU" : "► FOE"}</span>
        <span style={{ fontSize: 8, color: "#fff" }}>{player.name.toUpperCase()}</span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 6, color: "#666", marginBottom: 3, letterSpacing: 1 }}>HP</div>
        <HPBar hp={player.hp} maxHp={player.maxHp} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {player.shield && <StatusBadge label="SHIELD" color="#45aaf2" />}
        {player.reflectActive && <StatusBadge label="REFLECT" color="#a55eea" />}
        {player.poisoned > 0 && <StatusBadge label={`PSN-${player.poisoned}`} color="#78e08f" />}
        {player.skipNextTurn && <StatusBadge label="STUN" color="#fc5c65" />}
        {player.taunted && <StatusBadge label="TAUNTED" color="#fd9644" />}
        {player.regenStacks > 0 && <StatusBadge label={`REGEN×${player.regenStacks}`} color="#26de81" />}
        {player.extraTurn && <StatusBadge label="EXTRA TURN" color="#f9ca24" />}
        {player.counterStanceActive && <StatusBadge label="COUNTER" color="#45aaf2" />}
        {player.manaSurgeActive && <StatusBadge label="SURGE×2" color="#f9ca24" />}
        {player.plagueStacks > 0 && <StatusBadge label={`PLAGUE×${player.plagueStacks}`} color="#c44dff" />}
        {(player.skipTurns ?? 0) > 0 && <StatusBadge label={`FROZEN×${player.skipTurns}`} color="#74b9ff" />}
      </div>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 6, color, border: `1px solid ${color}`, padding: "2px 5px", letterSpacing: 1 }}>{label}</span>;
}

// ─── Hand card ────────────────────────────────────────────────────────────────

function HandCard({ cardId, index, total, onClick, disabled }: {
  cardId: CardId | "???"; index: number; total: number; onClick: () => void; disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isHidden = cardId === "???";
  const def = isHidden ? null : CARD_DEFS[cardId as CardId];
  const mid = (total - 1) / 2;
  const rotate = (index - mid) * 4;
  const translateY = Math.abs(index - mid) * 3;

  return (
    <div
      onClick={disabled || isHidden ? undefined : onClick}
      onMouseEnter={() => !disabled && !isHidden && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: disabled || isHidden ? "default" : "pointer",
        position: "relative", width: 120, minHeight: 180,
        background: isHidden ? "#0a0a14" : def!.bgColor,
        border: `2px solid ${isHidden ? "#1a1a2e" : hovered ? def!.color : def!.color + "55"}`,
        fontFamily: "'Press Start 2P', monospace",
        transform: hovered ? "translateY(-28px) rotate(0deg) scale(1.08)" : `translateY(${translateY}px) rotate(${rotate}deg)`,
        transition: "all 0.15s ease",
        opacity: disabled ? 0.45 : 1,
        boxShadow: hovered && def ? `0 0 0 1px ${def.color}, 0 0 18px ${def.glowColor}55, 0 0 36px ${def.glowColor}22` : "none",
        overflow: "hidden", flexShrink: 0,
      }}
    >
      {isHidden ? (
        <div style={{ height: "100%", minHeight: 180, background: "repeating-linear-gradient(45deg, #0d0d1a 0px, #0d0d1a 4px, #111128 4px, #111128 8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 32, height: 32, border: "1px solid #222", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#222" }}>?</div>
        </div>
      ) : def ? (
        <>
          <div style={{ height: 3, background: RARITY_COLORS[def.rarity], boxShadow: `0 0 4px ${RARITY_COLORS[def.rarity]}` }} />
          <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: `radial-gradient(circle, ${def.color}18 0%, transparent 70%)`, borderBottom: `1px solid ${def.color}22` }}>
            <span style={{ filter: `drop-shadow(0 0 5px ${def.glowColor})` }}>{def.icon}</span>
          </div>
          <div style={{ padding: "6px 6px 2px", textAlign: "center" }}>
            <div style={{ fontSize: 6, color: def.color, letterSpacing: 0.5, lineHeight: 1.6 }}>{def.name}</div>
          </div>
          <div style={{ textAlign: "center", padding: "1px 0" }}>
            <span style={{ fontSize: 5, color: RARITY_COLORS[def.rarity], letterSpacing: 1 }}>{RARITY_LABELS[def.rarity]}</span>
          </div>
          <div style={{ padding: "4px 6px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 5, color: "#777", lineHeight: 1.8 }}>{def.description}</div>
          </div>
          <div style={{ height: 2, background: def.color + "33" }} />
        </>
      ) : null}
    </div>
  );
}

// ─── Leaderboard panel ────────────────────────────────────────────────────────

function LeaderboardPanel({ entries, myToken, onClose }: { entries: LeaderboardEntry[]; myToken: string; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#080810", border: "2px solid #f9ca24", padding: "20px 24px", minWidth: 340, maxHeight: "80vh", overflowY: "auto", fontFamily: "'Press Start 2P', monospace", position: "relative" }}>
        <div style={{ fontSize: 9, color: "#f9ca24", letterSpacing: 2, marginBottom: 16, textAlign: "center" }}>★ LEADERBOARD ★</div>
        {entries.length === 0 && <div style={{ fontSize: 7, color: "#555", textAlign: "center" }}>No records yet.</div>}
        {entries.map((e, i) => (
          <div key={e.sessionToken} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a2e", color: e.sessionToken === myToken ? "#f9ca24" : "#aaa" }}>
            <span style={{ fontSize: 7, minWidth: 20, color: i === 0 ? "#f9ca24" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#555" }}>{i + 1}.</span>
            <span style={{ fontSize: 7, flex: 1, marginLeft: 8 }}>{e.name.toUpperCase()}</span>
            <span style={{ fontSize: 6, color: "#26de81", marginRight: 10 }}>{e.wins}W</span>
            <span style={{ fontSize: 6, color: "#fc5c65" }}>{e.losses}L</span>
          </div>
        ))}
        <button onClick={onClose} style={{ marginTop: 16, width: "100%", padding: "8px", fontSize: 7, background: "transparent", border: "1px solid #f9ca24", color: "#f9ca24", fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}>CLOSE</button>
      </div>
    </div>
  );
}

// ─── Name modal ───────────────────────────────────────────────────────────────

function NameModal({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Press Start 2P', monospace" }}>
      <div style={{ background: "#080810", border: "2px solid #45aaf2", padding: "28px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#45aaf2", marginBottom: 20, letterSpacing: 2 }}>ENTER YOUR NAME</div>
        <input value={val} onChange={e => setVal(e.target.value.slice(0, 16))} onKeyDown={e => e.key === "Enter" && val.trim() && onSubmit(val.trim())} autoFocus maxLength={16}
          style={{ background: "#0d0d1a", border: "1px solid #45aaf2", color: "#fff", padding: "8px 12px", fontSize: 10, fontFamily: "'Press Start 2P', monospace", width: 220, outline: "none", marginBottom: 16, display: "block" }} placeholder="WARRIOR" />
        <button onClick={() => val.trim() && onSubmit(val.trim())} style={{ background: "#45aaf2", border: "none", color: "#000", padding: "8px 20px", fontSize: 8, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}>ENTER ARENA</button>
      </div>
    </div>
  );
}

// ─── Share link ───────────────────────────────────────────────────────────────

function ShareLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  const copy = () => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ textAlign: "center", fontFamily: "'Press Start 2P', monospace" }}>
      <div style={{ fontSize: 6, color: "#555", marginBottom: 8, letterSpacing: 1 }}>SHARE THIS ROOM:</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontSize: 6, color: "#45aaf2", background: "#050510", border: "1px solid #1a1a2e", padding: "6px 10px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</div>
        <button onClick={copy} style={{ background: "transparent", border: "1px solid #45aaf2", color: copied ? "#26de81" : "#45aaf2", padding: "6px 10px", fontSize: 6, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1, whiteSpace: "nowrap" }}>{copied ? "COPIED!" : "COPY"}</button>
      </div>
    </div>
  );
}

// ─── Inactivity warning overlay ───────────────────────────────────────────────

function InactivityWarning({ secondsLeft, onStayIn, onLeave }: { secondsLeft: number; onStayIn: () => void; onLeave: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Press Start 2P', monospace" }}>
      <div style={{ background: "#080810", border: "2px solid #fc5c65", padding: "28px 32px", textAlign: "center", maxWidth: 320 }}>
        <div style={{ fontSize: 8, color: "#fc5c65", letterSpacing: 2, marginBottom: 12, animation: "blink 0.8s step-end infinite" }}>⚠ GAME STALLED ⚠</div>
        <div style={{ fontSize: 6, color: "#aaa", lineHeight: 2, marginBottom: 20 }}>
          No activity detected.<br />Auto-aborting in {secondsLeft}s...
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onStayIn} style={{ background: "transparent", border: "1px solid #26de81", color: "#26de81", padding: "8px 14px", fontSize: 6, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}>
            STAY IN
          </button>
          <button onClick={onLeave} style={{ background: "transparent", border: "1px solid #fc5c65", color: "#fc5c65", padding: "8px 14px", fontSize: 6, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}>
            ABORT
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Narration panel (left side) ─────────────────────────────────────────────

function NarrationPanel({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");
  const [key, setKey] = useState(0);

  // Typewriter effect — re-runs whenever text changes
  useEffect(() => {
    if (!text) return;
    setDisplayed("");
    setKey(k => k + 1);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
  }, [text]);

  if (!text) return null;

  return (
    <div style={{
      position: "fixed",
      left: 14,
      top: 70,
      width: 210,
      background: "#060610",
      border: "2px solid #1a1a2e",
      borderTop: "2px solid #f9ca24",
      fontFamily: "'Press Start 2P', monospace",
      zIndex: 10,
    }}>
      {/* Header */}
      <div style={{
        padding: "7px 9px",
        borderBottom: "1px solid #1a1a2e",
        fontSize: 6,
        color: "#f9ca24",
        letterSpacing: 2,
        background: "#0a0a18",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}>
        <span style={{ animation: "blink 2s step-end infinite" }}>▐</span> LAST MOVE
      </div>

      {/* Narration text */}
      <div style={{ padding: "12px 10px 14px" }}>
        <div style={{
          fontSize: 7,
          color: "#e0e0e0",
          lineHeight: 2.2,
          letterSpacing: 0.3,
          minHeight: 60,
        }}>
          {displayed}
          <span style={{ animation: "blink 0.6s step-end infinite", color: "#f9ca24" }}>_</span>
        </div>
      </div>

      {/* Decorative bottom strip */}
      <div style={{ padding: "3px 9px 7px", display: "flex", gap: 3 }}>
        {["#f9ca24","#fc5c65","#26de81","#45aaf2","#a55eea"].map((c, i) => (
          <div key={i} style={{ width: 5, height: 5, background: c, opacity: 0.5 }} />
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

const INACTIVITY_MS = 3 * 60 * 1000;
const WARNING_COUNTDOWN_S = 15;

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000";
const socket: Socket = io(SERVER_URL, {
  transports: ["websocket", "polling"],
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: false,
});

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameSet, setNameSet] = useState(false);
  const [roomFull, setRoomFull] = useState(false);

  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(WARNING_COUNTDOWN_S);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionToken = useRef(getOrCreateSession());
  const roomId = useRef(getRoomId());

  // ── Inactivity helpers ────────────────────────────────────────────────────

  const clearInactivityTimers = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
  };

  const startInactivityTimer = () => {
    clearInactivityTimers();
    setShowInactivityWarning(false);
    inactivityTimer.current = setTimeout(() => {
      setWarningCountdown(WARNING_COUNTDOWN_S);
      setShowInactivityWarning(true);
      let remaining = WARNING_COUNTDOWN_S;
      countdownInterval.current = setInterval(() => {
        remaining -= 1;
        setWarningCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownInterval.current!);
          socket.emit("forfeit");
          setTimeout(() => { window.location.href = window.location.origin; }, 300);
        }
      }, 1000);
    }, INACTIVITY_MS);
  };

  const handleStayIn = () => {
    clearInactivityTimers();
    setShowInactivityWarning(false);
    startInactivityTimer();
  };

  const handleInactivityLeave = () => {
    clearInactivityTimers();
    setShowInactivityWarning(false);
    socket.emit("forfeit");
    setTimeout(() => { window.location.href = window.location.origin; }, 300);
  };

  useEffect(() => {
    if (!gameState || gameState.gameOver || Object.keys(gameState.players).length < 2) {
      clearInactivityTimers();
      setShowInactivityWarning(false);
      return;
    }
    startInactivityTimer();
    return clearInactivityTimers;
  }, [gameState?.log]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    socket.on("stateUpdate", (s: GameState) => setGameState(s));
    socket.on("roomFull", () => setRoomFull(true));
    socket.on("leaderboard", (data: LeaderboardEntry[]) => setLeaderboard(data));

    socket.on("connect", () => {
      const name = localStorage.getItem("kramkard_name");
      if (name) {
        socket.emit("joinRoom", {
          roomId: roomId.current,
          sessionToken: sessionToken.current,
          preferredName: name,
        });
      }
    });

    const storedName = localStorage.getItem("kramkard_name");
    if (!storedName) {
      setShowNameModal(true);
      socket.connect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("stateUpdate");
      socket.off("roomFull");
      socket.off("leaderboard");
      socket.off("connect");
      clearInactivityTimers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function doJoin(name: string) {
    localStorage.setItem("kramkard_name", name);
    socket.emit("joinRoom", {
      roomId: roomId.current,
      sessionToken: sessionToken.current,
      preferredName: name,
    });
    setNameSet(true);
  }

  function handleNameSubmit(name: string) {
    setShowNameModal(false);
    doJoin(name);
    socket.emit("setName", name);
  }

  const playCard = (cardId: CardId) => socket.emit("playCard", cardId);
  const requestRematch = () => socket.emit("rematch");
  const openLeaderboard = () => { socket.emit("getLeaderboard"); setShowLeaderboard(true); };

const goHome = () => {
  window.location.href = window.location.origin + window.location.pathname.replace(/\/+$/, "");
};

const handleLeave = () => {
  if (isGameOver) { goHome(); return; }
  if (playerCount < 2) { goHome(); return; }
  if (window.confirm("Forfeit the match? Your opponent will be declared the winner.")) {
    socket.emit("forfeit");
    setTimeout(goHome, 300);
  }
};

  if (roomFull) {
    return (
      <div style={{ background: "#05050f", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Press Start 2P', monospace", color: "#fc5c65", fontSize: 10, textAlign: "center" }}>
        ROOM IS FULL.<br /><br />
        <span style={{ fontSize: 7, color: "#555" }}>Ask your friend for a different room link.</span>
      </div>
    );
  }

  const myToken = gameState?.myToken;
  const myPlayer = myToken ? gameState?.players[myToken] : null;
  const opponentToken = myToken ? Object.keys(gameState?.players ?? {}).find(t => t !== myToken) : null;
  const opponentPlayer = opponentToken ? gameState?.players[opponentToken] : null;
  const isMyTurn = gameState?.turn === myToken;
  const playerCount = Object.keys(gameState?.players ?? {}).length;
  const isGameOver = gameState?.gameOver ?? false;
  const winnerId = gameState?.winnerId;
  const winnerName = winnerId ? gameState?.players[winnerId]?.name : null;
  const iWon = winnerId === myToken;
  const myRematchReady = myPlayer?.rematchReady ?? false;
  const opponentRematchReady = opponentPlayer?.rematchReady ?? false;
  const lastNarration = gameState?.lastNarration ?? "";

  return (
    <div style={{ background: "#05050f", minHeight: "100vh", color: "#e0e0e0", fontFamily: "'Press Start 2P', monospace", overflowX: "hidden", position: "relative" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{color:#f9ca24;text-shadow:0 0 8px #f9ca24} 50%{color:#fff;text-shadow:0 0 20px #f9ca24} }
        @keyframes pixelIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }
      `}</style>

      <Starfield />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px)" }} />

      {showNameModal && <NameModal onSubmit={handleNameSubmit} />}
      {showLeaderboard && <LeaderboardPanel entries={leaderboard} myToken={myToken ?? ""} onClose={() => setShowLeaderboard(false)} />}
      {showInactivityWarning && (
        <InactivityWarning secondsLeft={warningCountdown} onStayIn={handleStayIn} onLeave={handleInactivityLeave} />
      )}

      {/* ── Left narration panel ── */}
      {playerCount === 2 && <NarrationPanel text={lastNarration} />}

      {/* ── Right battle log (bigger) ── */}
      <div style={{
        position: "fixed", right: 14, top: 70,
        width: 240,           // was 190
        maxHeight: "75vh",
        background: "#060610",
        border: "2px solid #1a1a2e",
        borderTop: "2px solid #a55eea",
        fontFamily: "'Press Start 2P', monospace",
        zIndex: 10, overflowY: "auto",
      }}>
        <div style={{ padding: "7px 9px", borderBottom: "1px solid #1a1a2e", fontSize: 6, color: "#a55eea", letterSpacing: 2, background: "#0a0a18", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ animation: "blink 2s step-end infinite" }}>▐</span> BATTLE LOG
        </div>
        <ul style={{ listStyle: "none", padding: "7px 9px", margin: 0 }}>
          {(gameState?.log ?? []).map((entry, i) => (
            <li key={i} style={{
              fontSize: 6,          // was 5
              color: i === 0 ? "#f9ca24" : "#555",
              lineHeight: 2,
              borderBottom: "1px solid #0d0d1a",
              paddingBottom: 6,
              marginBottom: 6,
              letterSpacing: 0.3,
            }}>{entry}</li>
          ))}
        </ul>
        <div style={{ padding: "3px 9px 7px", display: "flex", gap: 3 }}>
          {["#fc5c65","#f9ca24","#26de81","#45aaf2","#a55eea"].map((c, i) => (
            <div key={i} style={{ width: 5, height: 5, background: c, opacity: 0.5 }} />
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 2, maxWidth: 860, margin: "0 auto", padding: "16px 14px", minHeight: "100vh", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 6, color: "#a55eea", letterSpacing: 4, marginBottom: 4, animation: "blink 2s step-end infinite" }}>★ COSMIC ARENA ★</div>
          <h1 style={{ fontSize: 18, color: "#f9ca24", margin: 0, letterSpacing: 3, textShadow: "0 0 8px #f9ca24aa" }}>KRAM KARD</h1>
          <div style={{ fontSize: 5, color: "#222", marginTop: 4, letterSpacing: 2 }}>▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
          <button onClick={openLeaderboard} style={{ background: "transparent", border: "1px solid #a55eea", color: "#a55eea", padding: "5px 14px", fontSize: 6, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}>
            ★ LEADERBOARD
          </button>
          <button
            onClick={() => { window.location.href = window.location.origin; }}
            style={{ background: "transparent", border: "1px solid #fc5c65", color: "#fc5c65", padding: "5px 14px", fontSize: 6, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}
          >
            {isGameOver ? "✕ EXIT" : "✕ FORFEIT"}
          </button>
        </div>

        {/* Turn banner */}
        <div style={{ textAlign: "center", fontSize: 7, color: isMyTurn ? "#f9ca24" : "#444", letterSpacing: 2, minHeight: 16, transition: "color .3s", textShadow: isMyTurn ? "0 0 6px #f9ca24" : "none", animation: isMyTurn ? "blink 1.2s step-end infinite" : "none" }}>
          {!isGameOver && (playerCount === 2 ? (isMyTurn ? "► YOUR TURN — PICK A CARD ◄" : "-- OPPONENT'S TURN --") : "")}
        </div>

        {/* Opponent */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {opponentPlayer && (
            <div style={{ animation: "pixelIn 0.3s ease" }}>
              <BattleCard player={opponentPlayer} isActive={!isMyTurn && !isGameOver} isMine={false} />
            </div>
          )}
          {opponentPlayer && (
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
              {opponentPlayer.hand.map((_, i) => (
                <div key={i} style={{ width: 24, height: 36, transform: `rotate(${(i - Math.floor(opponentPlayer.hand.length / 2)) * 4}deg)`, background: "repeating-linear-gradient(45deg, #0d0d1a 0, #0d0d1a 3px, #111128 3px, #111128 6px)", border: "1px solid #1a1a2e" }} />
              ))}
            </div>
          )}
        </div>

        {playerCount === 2 && <div style={{ textAlign: "center", fontSize: 7, color: "#222", letterSpacing: 5 }}>──── VS ────</div>}

        {/* My area */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {myPlayer && (
            <div style={{ animation: "pixelIn 0.3s ease" }}>
              <BattleCard player={myPlayer} isActive={isMyTurn && !isGameOver} isMine={true} />
            </div>
          )}
          {myPlayer && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "center", flexWrap: "wrap", paddingTop: 8, minHeight: 200 }}>
              {myPlayer.hand.map((cardId, i) => (
                <HandCard
                  key={`${cardId}-${i}`}
                  cardId={cardId}
                  index={i}
                  total={myPlayer.hand.length}
                  onClick={() => cardId !== "???" && playCard(cardId as CardId)}
                  disabled={!isMyTurn || isGameOver}
                />
              ))}
            </div>
          )}
        </div>

        {/* Waiting */}
        {playerCount < 2 && nameSet && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center", marginTop: 16 }}>
            <div style={{ fontSize: 7, color: "#444", letterSpacing: 2, animation: "blink 1s step-end infinite" }}>▓ WAITING FOR PLAYER 2 ▓</div>
            <ShareLink roomId={roomId.current} />
          </div>
        )}

        {/* Game over */}
        {isGameOver && winnerName && (
          <div style={{ textAlign: "center", marginTop: 16, animation: "slideUp 0.4s ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, animation: "pulse 1.2s ease-in-out infinite" }}>{iWon ? "★ VICTORY! ★" : "✕ DEFEAT ✕"}</div>
            <div style={{ fontSize: 7, color: iWon ? "#f9ca24" : "#fc5c65" }}>{winnerName.toUpperCase()} WINS!</div>
            {playerCount === 2 && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  onClick={requestRematch}
                  disabled={myRematchReady}
                  style={{ background: myRematchReady ? "#1a1a0a" : "transparent", border: `1px solid ${myRematchReady ? "#555" : "#f9ca24"}`, color: myRematchReady ? "#555" : "#f9ca24", padding: "8px 18px", fontSize: 7, fontFamily: "'Press Start 2P', monospace", cursor: myRematchReady ? "default" : "pointer", letterSpacing: 1 }}
                >
                  {myRematchReady ? "READY ✓" : "REMATCH?"}
                </button>
                <button
                  onClick={() => { window.location.href = window.location.origin; }}
                  style={{ background: "transparent", border: "1px solid #fc5c65", color: "#fc5c65", padding: "8px 18px", fontSize: 7, fontFamily: "'Press Start 2P', monospace", cursor: "pointer", letterSpacing: 1 }}
                >
                  ✕ LEAVE
                </button>
              </div>
            )}
            {opponentRematchReady && !myRematchReady && <div style={{ fontSize: 6, color: "#26de81", display: "flex", alignItems: "center" }}>FOE READY!</div>}
            {myRematchReady && !opponentRematchReady && <div style={{ fontSize: 6, color: "#555", animation: "blink 1s step-end infinite" }}>WAITING FOR OPPONENT...</div>}
          </div>
        )}
      </div>
    </div>
  );
}