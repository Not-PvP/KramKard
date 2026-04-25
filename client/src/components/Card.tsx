import React from "react";

interface CardProps {
  name: string;
  hp: number;
  attack: number;
  isMine: boolean;
  isActive: boolean;
}

const Card: React.FC<CardProps> = ({ name, hp, attack, isMine, isActive }) => {
  return (
    <div
      className="card"
      style={{
        border: isActive ? "3px solid #0f0" : "2px solid #555",
        borderRadius: "15px",
        padding: "20px",
        margin: "10px",
        width: "220px",
        background: "linear-gradient(135deg, #222, #333)",
        color: "white",
        textAlign: "center",
        boxShadow: isActive ? "0 0 20px #0f0" : "0 0 10px #000",
        fontFamily: "'Cinzel', serif",
        transition: "transform 0.3s ease, box-shadow 0.3s ease"
      }}
    >
      <h3>{isMine ? "Your Card: " + name : name}</h3>
      <div style={{ background: "#400", height: "20px", borderRadius: "5px", marginBottom: "5px" }}>
        <div
          className="hp-bar"
          style={{
            width: `${hp}%`,
            background: "#0f0",
            height: "100%",
            borderRadius: "5px",
            transition: "width 0.5s ease"
          }}
        />
      </div>
      <p>HP: {hp}</p>
      <p>Attack: {attack}</p>
    </div>
  );
};

export default Card;