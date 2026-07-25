import { loadConfig } from "./config.js";
import { fetchCodexUsage, flattenForMqtt } from "./codexUsage.js";
import {
  createMqttClient,
  publishAvailability,
  publishDiscovery,
  publishState,
} from "./mqttHa.js";

const config = loadConfig();
console.log(`Connecting to MQTT: ${config.mqtt.url}`);
console.log("If the connection succeeds, you will see 'MQTT connected.'.");

const client = createMqttClient(config.mqtt);

let discoveryPublished = false;
let running = false;
let lastPublishedState = null;

// captured_at and the *_reset_after_seconds countdowns change on every poll
// by design, so they're excluded when deciding whether the state is
// meaningfully different from what was last published.
function significantState(state) {
  const {
    captured_at,
    primary_reset_after_seconds,
    secondary_reset_after_seconds,
    ...rest
  } = state;
  return rest;
}

function hasChanged(previous, next) {
  if (!previous) return true;
  return (
    JSON.stringify(significantState(previous)) !==
    JSON.stringify(significantState(next))
  );
}

client.on("connect", async () => {
  console.log("MQTT connected.");
  try {
    await publishAvailability(client, config, "online");
    await publishDiscovery(client, config);
    discoveryPublished = true;
    await pollOnce();
  } catch (error) {
    console.error(error.message);
  }
});

client.on("error", (error) => {
  console.error(`MQTT error: ${error.message}`);
});

async function pollOnce() {
  if (running) return;
  running = true;

  try {
    if (!discoveryPublished) {
      await publishDiscovery(client, config);
      discoveryPublished = true;
    }

    const usage = await fetchCodexUsage(config.codex);
    const state = flattenForMqtt(usage);
    await publishAvailability(client, config, "online");

    if (hasChanged(lastPublishedState, state)) {
      await publishState(client, config, state);
      lastPublishedState = state;
      console.log(
        `Published Codex usage: 5h ${state.primary_used_percent ?? "?"}% used, weekly ${state.secondary_used_percent ?? "?"}% used.`,
      );
    } else {
      console.log("Codex usage unchanged, skipping publish.");
    }
  } catch (error) {
    await publishAvailability(client, config, "offline").catch(() => {});
    console.error(`Poll failed: ${error.message}`);
  } finally {
    running = false;
  }
}

setInterval(pollOnce, config.pollSeconds * 1000);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await publishAvailability(client, config, "offline").catch(() => {});
    client.end();
    process.exit(0);
  });
}
