/**
 * Smart Home API Service
 * ---------------------
 * Handles communication with NodeMCU ESP8266 or Firebase Realtime Database.
 * Replace NODEMCU_IP and FIREBASE_URL with your actual values.
 */

// ─── Configuration ───────────────────────────────────────────────────────────
// These values are securely loaded from a hidden .env.local file
const NODEMCU_IP = import.meta.env.VITE_NODEMCU_IP || '192.168.1.100'; 
const NODEMCU_BASE_URL = `http://${NODEMCU_IP}`;

const FIREBASE_URL = import.meta.env.VITE_FIREBASE_URL || 'https://your-project.firebaseio.com';
const FIREBASE_PATH = '/devices';

// ─── Mode Toggle ────────────────────────────────────────────────────────────
// Set to 'nodemcu', 'firebase', or 'websocket'
const MODE = 'firebase';

// ─── NodeMCU HTTP Fetch API ──────────────────────────────────────────────────
/**
 * Sends an ON/OFF command to the NodeMCU via HTTP GET.
 * NodeMCU endpoint example: http://192.168.1.100/control?device=light1&state=ON
 *
 * @param {string} deviceId - e.g. 'light1', 'light2', 'fan', 'ac'
 * @param {boolean} state   - true = ON, false = OFF
 */
export async function sendCommandToNodeMCU(deviceId, state) {
  const value = state ? 'ON' : 'OFF';
  const url = `${NODEMCU_BASE_URL}/control?device=${deviceId}&state=${value}`;
  try {
    const response = await fetch(url, { method: 'GET' });
    console.log(`[NodeMCU] Sent ${deviceId} → ${value}`, response);
    return { success: true, device: deviceId, state: value };
  } catch (error) {
    console.error(`[NodeMCU] Failed to send command for ${deviceId}:`, error);
    return { success: false, error };
  }
}

/**
 * Pings Firebase to read the NodeMCU's heartbeat uptime.
 */
export async function getNodeMCUStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${FIREBASE_URL}/status.json`, { 
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data ? data.uptime : null;
  } catch (error) {
    return null;
  }
}

// ─── Firebase REST API ───────────────────────────────────────────────────────
/**
 * Updates device state in Firebase Realtime Database via REST PATCH.
 * Firebase DB structure: /devices/{deviceId}/state = "ON" | "OFF"
 *
 * @param {string} deviceId - e.g. 'light1', 'light2', 'fan', 'ac'
 * @param {boolean} state   - true = ON, false = OFF
 */
export async function sendCommandToFirebase(deviceId, state) {
  const value = state ? 'ON' : 'OFF';
  const url = `${FIREBASE_URL}${FIREBASE_PATH}/${deviceId}.json`;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: value }),
    });
    const data = await response.json();
    console.log(`[Firebase] Updated ${deviceId} → ${value}`, data);
    return { success: true, device: deviceId, state: value };
  } catch (error) {
    console.error(`[Firebase] Failed to update ${deviceId}:`, error);
    return { success: false, error };
  }
}

// ─── WebSocket Controller ────────────────────────────────────────────────────
let socket = null;

/**
 * Initializes a WebSocket connection to the NodeMCU.
 * The NodeMCU must run a WebSocket server (e.g. using the arduinoWebSockets library).
 *
 * @param {Function} onMessageCallback - called with parsed messages from the device
 */
export function initWebSocket(onMessageCallback) {
  socket = new WebSocket(`ws://${NODEMCU_IP}:81`); // NodeMCU WebSocket default port

  socket.addEventListener('open', () => {
    console.log('[WebSocket] Connected to NodeMCU');
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('[WebSocket] Message from NodeMCU:', data);
      if (onMessageCallback) onMessageCallback(data);
    } catch {
      console.warn('[WebSocket] Non-JSON message:', event.data);
    }
  });

  socket.addEventListener('close', () => {
    console.warn('[WebSocket] Connection closed. Reconnecting in 5s...');
    setTimeout(() => initWebSocket(onMessageCallback), 5000);
  });

  socket.addEventListener('error', (err) => {
    console.error('[WebSocket] Error:', err);
  });
}

/**
 * Sends a command via an active WebSocket connection.
 *
 * @param {string} deviceId - e.g. 'light1', 'light2', 'fan', 'ac'
 * @param {boolean} state   - true = ON, false = OFF
 */
export function sendCommandViaWebSocket(deviceId, state) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error('[WebSocket] Not connected. Cannot send command.');
    return;
  }
  const payload = JSON.stringify({ device: deviceId, state: state ? 'ON' : 'OFF' });
  socket.send(payload);
  console.log(`[WebSocket] Sent → ${payload}`);
}

// ─── Unified Command Dispatcher ──────────────────────────────────────────────
/**
 * Central function used by the UI to control devices.
 * Switch MODE above to change the communication method.
 *
 * @param {string} deviceId - device identifier
 * @param {boolean} state   - new desired state
 */
export async function controlDevice(deviceId, state) {
  switch (MODE) {
    case 'firebase':
      return await sendCommandToFirebase(deviceId, state);
    case 'websocket':
      return sendCommandViaWebSocket(deviceId, state);
    case 'nodemcu':
    default:
      return await sendCommandToNodeMCU(deviceId, state);
  }
}
