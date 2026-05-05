import { EventEmitter } from "node:events";
import net from "node:net";

function encodeString(value) {
  const body = Buffer.from(String(value), "utf8");
  const len = Buffer.alloc(2);
  len.writeUInt16BE(body.length, 0);
  return Buffer.concat([len, body]);
}

function encodeRemainingLength(length) {
  const bytes = [];
  do {
    let encoded = length % 128;
    length = Math.floor(length / 128);
    if (length > 0) encoded |= 128;
    bytes.push(encoded);
  } while (length > 0);
  return Buffer.from(bytes);
}

function packet(typeAndFlags, variableHeader, payload = Buffer.alloc(0)) {
  const remaining = variableHeader.length + payload.length;
  return Buffer.concat([
    Buffer.from([typeAndFlags]),
    encodeRemainingLength(remaining),
    variableHeader,
    payload,
  ]);
}

function connectPacket(options) {
  const clientId =
    options.clientId || `codex-ha-${Math.random().toString(16).slice(2)}`;
  let flags = 0b00000010;
  const payload = [encodeString(clientId)];

  if (options.username) {
    flags |= 0b10000000;
    payload.push(encodeString(options.username));
  }
  if (options.password) {
    flags |= 0b01000000;
    payload.push(encodeString(options.password));
  }

  const variableHeader = Buffer.concat([
    encodeString("MQTT"),
    Buffer.from([4, flags, 0, 60]),
  ]);

  return packet(0x10, variableHeader, Buffer.concat(payload));
}

function publishPacket(topic, message, retain) {
  const fixedHeader = retain ? 0x31 : 0x30;
  return packet(fixedHeader, encodeString(topic), Buffer.from(message, "utf8"));
}

export class SimpleMqttClient extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = new URL(url);
    if (this.url.protocol !== "mqtt:") {
      throw new Error("Built-in MQTT client only supports mqtt:// URLs.");
    }
    this.options = options;
    this.queue = [];
    this.connected = false;
    this.ended = false;
    this.connect();
  }

  connect() {
    const host = this.url.hostname;
    const port = Number(this.url.port || 1883);
    this.socket = net.createConnection({ host, port }, () => {
      this.socket.write(connectPacket(this.options));
    });
    this.socket.setTimeout(15000, () => {
      this.emit(
        "error",
        new Error(`MQTT connection timed out: ${host}:${port}`),
      );
      this.socket.destroy();
    });

    this.socket.on("data", (chunk) => {
      const packetType = chunk[0] >> 4;
      if (packetType === 2 && chunk[3] === 0) {
        this.socket.setTimeout(0);
        this.connected = true;
        this.emit("connect");
        this.flush();
      } else if (packetType === 2 && chunk[3] !== 0) {
        this.emit(
          "error",
          new Error(`MQTT broker rejected the login. CONNACK code: ${chunk[3]}`),
        );
        this.socket.destroy();
      }
    });

    this.socket.on("error", (error) => this.emit("error", error));
    this.socket.on("close", () => {
      this.connected = false;
      if (!this.ended) setTimeout(() => this.connect(), 5000);
    });
  }

  publish(topic, message, options = {}, callback = () => {}) {
    const job = { topic, message, retain: Boolean(options.retain), callback };
    if (!this.connected) {
      this.queue.push(job);
      return;
    }
    this.writePublish(job);
  }

  writePublish(job) {
    this.socket.write(
      publishPacket(job.topic, job.message, job.retain),
      job.callback,
    );
  }

  flush() {
    const pending = this.queue.splice(0);
    for (const job of pending) this.writePublish(job);
  }

  end() {
    this.ended = true;
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(Buffer.from([0xe0, 0x00]));
      this.socket.end();
    }
  }
}
