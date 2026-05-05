import { SimpleMqttClient } from "./simpleMqtt.js";

const SENSOR_DEFS = [
  ["primary_used_percent", "Codex 5h Used", "%", "mdi:timer-sand"],
  ["primary_remaining_percent", "Codex 5h Remaining", "%", "mdi:timer-outline"],
  ["primary_reset_time", "Codex 5h Reset", null, "mdi:clock-outline"],
  ["secondary_used_percent", "Codex Weekly Used", "%", "mdi:calendar-week"],
  [
    "secondary_remaining_percent",
    "Codex Weekly Remaining",
    "%",
    "mdi:calendar-check",
  ],
  ["secondary_reset_time", "Codex Weekly Reset", null, "mdi:calendar-clock"],
  ["credits_balance", "Codex Credits", "credits", "mdi:cash"],
  ["plan", "Codex Plan", null, "mdi:account-badge"],
  ["rate_limit_reached_type", "Codex Limit Status", null, "mdi:alert-circle"],
];

export function createMqttClient(config) {
  return new SimpleMqttClient(config.url, {
    username: config.username,
    password: config.password,
  });
}

function discoveryTopic(config, key) {
  return `${config.mqtt.discoveryPrefix}/sensor/${config.device.id}/${key}/config`;
}

function stateTopic(config) {
  return `${config.mqtt.baseTopic}/state`;
}

function availabilityTopic(config) {
  return `${config.mqtt.baseTopic}/availability`;
}

export async function publishDiscovery(client, config) {
  const device = {
    identifiers: [config.device.id],
    name: config.device.name,
    manufacturer: "OpenAI",
    model: "Codex Usage Bridge",
  };

  for (const [key, name, unit, icon] of SENSOR_DEFS) {
    const payload = {
      name,
      unique_id: `${config.device.id}_${key}`,
      state_topic: stateTopic(config),
      availability_topic: availabilityTopic(config),
      value_template: `{{ value_json.${key} }}`,
      json_attributes_topic: stateTopic(config),
      device,
      icon,
    };

    if (unit) payload.unit_of_measurement = unit;

    await publish(client, discoveryTopic(config, key), payload, true);
  }
}

export async function publishAvailability(client, config, status) {
  await publish(client, availabilityTopic(config), status, true);
}

export async function publishState(client, config, state) {
  await publish(client, stateTopic(config), state, true);
}

function publish(client, topic, payload, retain = false) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    client.publish(topic, body, { qos: 0, retain }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
