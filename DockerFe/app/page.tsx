"use client";

import { FormEvent, useEffect, useState } from "react";

type Message = {
  id: number;
  text: string;
  createdAt: string;
};

export default function Home() {
  const [health, setHealth] = useState("checking...");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");

  // Notice the URLs are relative ("/api/..."). The browser sends them to the
  // frontend, and the rewrite in next.config.ts forwards them to the backend.
  async function loadMessages() {
    try {
      const res = await fetch("/api/messages");
      setMessages(await res.json());
    } catch {
      setMessages([]);
    }
  }

  async function addMessage(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setText("");
    loadMessages();
  }

  // Initial load. State is set inside .then() callbacks (after the fetch
  // finishes), which is what React's lint rules expect inside an effect.
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("DOWN"));
    fetch("/api/messages")
      .then((res) => res.json())
      .then(setMessages)
      .catch(() => setMessages([]));
  }, []);

  return (
    <main>
      <h1>Docker Messages</h1>

      <p>
        Backend status:{" "}
        <strong className={health === "UP" ? "status-up" : "status-down"}>{health}</strong>
      </p>

      <form onSubmit={addMessage}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
        />
        <button type="submit">Add</button>
      </form>

      <h2>Messages</h2>
      {messages.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <ul>
          {messages.map((m) => (
            <li key={m.id}>{m.text}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
