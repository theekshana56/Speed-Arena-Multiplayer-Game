import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

const WS_URL = "http://127.0.0.1:8080/ws-racing";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onceWithTimeout(register, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${label}`)), timeoutMs);
    register((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

function createClient() {
  return new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    reconnectDelay: 0,
  });
}

async function activate(client, name) {
  await onceWithTimeout((done) => {
    client.onConnect = () => done(true);
    client.onStompError = (frame) => {
      throw new Error(`[${name}] STOMP error: ${frame.headers?.message || frame.body}`);
    };
    client.activate();
  }, 7000, `${name} connection`);
}

async function runChecks() {
  const a = createClient();
  const b = createClient();
  const results = [];

  try {
    await activate(a, "A");
    await activate(b, "B");

    const room = "qa_room_main";
    const otherRoom = "qa_room_other";

    // T1 - Ping / Pong
    const pongPromise = onceWithTimeout((done) => {
      a.subscribe("/topic/pong", (msg) => done(msg.body));
    }, 5000, "pong");
    a.publish({ destination: "/app/game.ping", body: "qa-check" });
    const pong = await pongPromise;
    results.push({ id: "T1", pass: pong.includes("PONG"), detail: pong });

    // T2 - Room players list has both users
    const playersPromise = onceWithTimeout((done) => {
      a.subscribe(`/topic/room/${room}/players`, (msg) => {
        const list = JSON.parse(msg.body);
        if (Array.isArray(list) && list.length >= 2) done(list.length);
      });
    }, 5000, "room players >= 2");
    a.publish({
      destination: "/app/player.join",
      body: JSON.stringify({ playerId: "qa_a", roomId: room, carColor: "red", x: 0, y: 0, angle: 0, speed: 0 }),
    });
    b.publish({
      destination: "/app/player.join",
      body: JSON.stringify({ playerId: "qa_b", roomId: room, carColor: "blue", x: 1, y: 1, angle: 0, speed: 0 }),
    });
    const count = await playersPromise;
    results.push({ id: "T2", pass: count >= 2, detail: `players=${count}` });

    // T3 - Cross-room isolation for game-state
    let leaked = false;
    a.subscribe(`/topic/room/${room}/game-state`, (msg) => {
      const car = JSON.parse(msg.body);
      if (car.roomId === otherRoom) leaked = true;
    });
    await delay(200);
    b.publish({
      destination: "/app/car.move",
      body: JSON.stringify({
        playerId: "qa_other",
        roomId: otherRoom,
        x: 50,
        y: 60,
        angle: 0,
        speed: 3,
        lapsCompleted: 0,
        status: "RACING",
      }),
    });
    await delay(800);
    results.push({ id: "T3", pass: !leaked, detail: leaked ? "cross-room leak detected" : "isolated by room" });
  } finally {
    a.deactivate();
    b.deactivate();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({ results, failed: failed.length }, null, 2));
  process.exit(failed.length ? 2 : 0);
}

runChecks().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
