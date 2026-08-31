import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import test from "node:test";

import { SimpleMqttClient } from "../src/simpleMqtt.js";

test("sends MQTT keepalive pings", async () => {
  let sawPing;
  const ping = new Promise((resolve) => {
    sawPing = resolve;
  });
  const server = net.createServer((socket) => {
    let connected = false;
    socket.on("data", (chunk) => {
      if (!connected) {
        assert.equal(chunk[0] >> 4, 1);
        connected = true;
        socket.write(Buffer.from([0x20, 0x02, 0x00, 0x00]));
      } else if (chunk[0] >> 4 === 12) {
        sawPing();
        socket.write(Buffer.from([0xd0, 0x00]));
      }
    });
  });

  await once(server.listen(0, "127.0.0.1"), "listening");
  const { port } = server.address();
  const client = new SimpleMqttClient(`mqtt://127.0.0.1:${port}`, {
    keepalive: 1,
  });
  let timeout;

  try {
    await Promise.race([
      ping,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("MQTT keepalive ping timed out")),
          2000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    client.end();
    server.close();
    await once(server, "close");
  }
});
