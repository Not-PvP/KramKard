import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3000"); // change to your deployed backend URL later

function App() {
  const [gameState, setGameState] = useState({ players: {}, turn: null });
  const myId = socket.id;

  useEffect(() => {
    socket.on("stateUpdate", (state) => {
      setGameState(state);
    });
  }, []);

  const attack = (targetId) => {
    socket.emit("attack", targetId);
  };

  return (
    <div>
      <h1>Multiplayer Card Game Demo</h1>
      <p>Your ID: {myId}</p>
      <h2>Players</h2>
      {Object.entries(gameState.players).map(([id, stats]) => (
        <div key={id}>
          <p>{id} - HP: {stats.hp}</p>
          {id !== myId && gameState.turn === myId && (
            <button onClick={() => attack(id)}>Attack</button>
          )}
        </div>
      ))}
      <p>Current Turn: {gameState.turn}</p>
    </div>
  );
}

export default App;
