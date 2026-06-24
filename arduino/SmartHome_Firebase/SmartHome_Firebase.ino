#include <ArduinoJson.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <time.h>

#include "secrets.h"

// -------------------------------------------------------------------
// 1. YOUR CREDENTIALS (NOW HIDDEN FOR GITHUB SAFETY)
// -------------------------------------------------------------------
const char *ssid = SECRET_SSID;
const char *password = SECRET_PASS;

// The Firebase Database URLs
const String FIREBASE_URL = SECRET_FIREBASE_URL;
const String FIREBASE_URL_STATUS = SECRET_FIREBASE_STATUS_URL;

// -------------------------------------------------------------------
// 2. HARDWARE PINS
// -------------------------------------------------------------------
#define RELAY_LIGHT_1 D1 // GPIO5
#define RELAY_LIGHT_2 D2 // GPIO4
#define RELAY_FAN     D5 // GPIO14
#define RELAY_AC      D6 // GPIO12 (Reverted to D6 per user request)

#define BTN_LIGHT_1   D7 // GPIO13
#define BTN_LIGHT_2   D3 // GPIO0  (Note: Don't hold at boot)
#define BTN_FAN       D4 // GPIO2  (Note: Don't hold at boot)
#define BTN_AC        3  // RX Pin (Must move off D8 to stop ghost button presses!)

// -------------------------------------------------------------------
// 3. STATE VARIABLES
// -------------------------------------------------------------------
bool stateL1 = false, stateL2 = false, stateFan = false, stateAC = false;
bool lastBtnL1 = HIGH, lastBtnL2 = HIGH, lastBtnFan = HIGH, lastBtnAC = HIGH;

// Schedule storage (HH:MM format, empty = no schedule)
String schedL1_on = "", schedL1_off = "";
String schedL2_on = "", schedL2_off = "";
String schedFan_on = "", schedFan_off = "";
String schedAC_on = "", schedAC_off = "";

unsigned long lastUpdate = 0;
unsigned long lastDebounce = 0;
unsigned long lastScheduleCheck = 0;
bool timeReady = false;

// -------------------------------------------------------------------
// RELAY DRIVER
// -------------------------------------------------------------------
void applyRelays() {
  digitalWrite(RELAY_LIGHT_1, stateL1 ? LOW : HIGH);
  digitalWrite(RELAY_LIGHT_2, stateL2 ? LOW : HIGH);
  digitalWrite(RELAY_FAN, stateFan ? LOW : HIGH);
  digitalWrite(RELAY_AC, stateAC ? LOW : HIGH);
}

// -------------------------------------------------------------------
// NTP TIME — returns current IST time as "HH:MM"
// -------------------------------------------------------------------
String getCurrentTime() {
  time_t now = time(nullptr);
  struct tm *t = localtime(&now);
  if (t->tm_year < 100)
    return ""; // Not synced yet
  char buf[6];
  sprintf(buf, "%02d:%02d", t->tm_hour, t->tm_min);
  return String(buf);
}

// -------------------------------------------------------------------
// FIREBASE PUSH — update a single device state
// -------------------------------------------------------------------
void updateFirebase(const String &deviceId, bool state) {
  if (WiFi.status() != WL_CONNECTED)
    return;
  std::unique_ptr<BearSSL::WiFiClientSecure> client(
      new BearSSL::WiFiClientSecure);
  client->setInsecure();
  HTTPClient https;
  // Build URL: replace devices.json with devices/{deviceId}.json
  String url = FIREBASE_URL;
  url.replace(".json", "/" + deviceId + ".json");
  if (https.begin(*client, url)) {
    https.addHeader("Content-Type", "application/json");
    String payload = "{\"state\":\"" + String(state ? "ON" : "OFF") + "\"}";
    https.sendRequest("PATCH", payload);
    https.end();
  }
}

// -------------------------------------------------------------------
// SCHEDULE ENGINE — check if any schedule matches the current time
// -------------------------------------------------------------------
void checkSchedules(const String &currentTime) {
  if (currentTime.length() == 0)
    return; // NTP not ready

  // Light 1
  if (schedL1_on == currentTime && !stateL1) {
    stateL1 = true;
    applyRelays();
    updateFirebase("light1", true);
    Serial.println("[SCHED] Light1 ON");
  }
  if (schedL1_off == currentTime && stateL1) {
    stateL1 = false;
    applyRelays();
    updateFirebase("light1", false);
    Serial.println("[SCHED] Light1 OFF");
  }

  // Light 2
  if (schedL2_on == currentTime && !stateL2) {
    stateL2 = true;
    applyRelays();
    updateFirebase("light2", true);
    Serial.println("[SCHED] Light2 ON");
  }
  if (schedL2_off == currentTime && stateL2) {
    stateL2 = false;
    applyRelays();
    updateFirebase("light2", false);
    Serial.println("[SCHED] Light2 OFF");
  }

  // Fan
  if (schedFan_on == currentTime && !stateFan) {
    stateFan = true;
    applyRelays();
    updateFirebase("fan", true);
    Serial.println("[SCHED] Fan ON");
  }
  if (schedFan_off == currentTime && stateFan) {
    stateFan = false;
    applyRelays();
    updateFirebase("fan", false);
    Serial.println("[SCHED] Fan OFF");
  }

  // AC
  if (schedAC_on == currentTime && !stateAC) {
    stateAC = true;
    applyRelays();
    updateFirebase("ac", true);
    Serial.println("[SCHED] AC ON");
  }
  if (schedAC_off == currentTime && stateAC) {
    stateAC = false;
    applyRelays();
    updateFirebase("ac", false);
    Serial.println("[SCHED] AC OFF");
  }
}

// -------------------------------------------------------------------
// SETUP
// -------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  // Configure Relay Pins exactly as they were yesterday
  pinMode(RELAY_LIGHT_1, OUTPUT);
  pinMode(RELAY_LIGHT_2, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  pinMode(RELAY_AC, OUTPUT);

  // Relays are active LOW (HIGH means OFF)
  digitalWrite(RELAY_LIGHT_1, HIGH);
  digitalWrite(RELAY_LIGHT_2, HIGH);
  digitalWrite(RELAY_FAN, HIGH);
  digitalWrite(RELAY_AC, HIGH);

  // Configure Button Pins
  pinMode(BTN_LIGHT_1, INPUT_PULLUP);
  pinMode(BTN_LIGHT_2, INPUT_PULLUP);
  pinMode(BTN_FAN, INPUT_PULLUP);
  pinMode(BTN_AC, INPUT_PULLUP);

  // Connect to WiFi
  Serial.println();
  Serial.print("Connecting to WiFi ");
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");

  // Force physical relays to match internal initial state (OFF)
  applyRelays();

  // ── NTP Time Sync (IST = UTC + 5:30) ──
  configTime(5 * 3600 + 30 * 60, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("[NTP] Syncing time");
  time_t now = time(nullptr);
  int tries = 0;
  while (now < 100000 && tries < 20) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    tries++;
  }
  if (now > 100000) {
    timeReady = true;
    Serial.println("\n[NTP] Time synced: " + getCurrentTime());
  } else {
    Serial.println("\n[NTP] Sync failed, will retry later.");
  }
}

// -------------------------------------------------------------------
// MAIN LOOP
// -------------------------------------------------------------------
void loop() {
  // 1. WiFi Auto-Reconnect
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000) {
      delay(10);
    }
  }

  // 2. Physical Button Polling (RESPONSIVE — runs every loop iteration)
  if (millis() - lastDebounce > 200) {
    bool b1 = digitalRead(BTN_LIGHT_1);
    if (b1 == LOW && lastBtnL1 == HIGH) {
      stateL1 = !stateL1;
      applyRelays();
      updateFirebase("light1", stateL1);
      Serial.println("Manual: Light 1 Toggled");
      lastDebounce = millis();
    }
    lastBtnL1 = b1;

    bool b2 = digitalRead(BTN_LIGHT_2);
    if (b2 == LOW && lastBtnL2 == HIGH) {
      stateL2 = !stateL2;
      applyRelays();
      updateFirebase("light2", stateL2);
      Serial.println("Manual: Light 2 Toggled");
      lastDebounce = millis();
    }
    lastBtnL2 = b2;

    bool bf = digitalRead(BTN_FAN);
    if (bf == LOW && lastBtnFan == HIGH) {
      stateFan = !stateFan;
      applyRelays();
      updateFirebase("fan", stateFan);
      Serial.println("Manual: Fan Toggled");
      lastDebounce = millis();
    }
    lastBtnFan = bf;

    bool ba = digitalRead(BTN_AC);
    if (ba == LOW && lastBtnAC == HIGH) {
      stateAC = !stateAC;
      applyRelays();
      updateFirebase("ac", stateAC);
      Serial.println("Manual: AC Toggled");
      lastDebounce = millis();
    }
    lastBtnAC = ba;
  }

  // 3. Cloud (Firebase) Polling every 2s — read states AND schedules
  if (millis() - lastUpdate > 2000) {
    lastUpdate = millis();
    std::unique_ptr<BearSSL::WiFiClientSecure> client(
        new BearSSL::WiFiClientSecure);
    client->setInsecure();
    HTTPClient https;

    if (https.begin(*client, FIREBASE_URL)) {
      int code = https.GET();
      if (code == HTTP_CODE_OK) {
        String payload = https.getString();

        // Parse with ArduinoJson
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, payload);

        if (!err) {
          // ── Read device ON/OFF states ──
          bool nL1 = (doc["light1"]["state"] == "ON");
          bool nL2 = (doc["light2"]["state"] == "ON");
          bool nFan = (doc["fan"]["state"] == "ON");
          bool nAC = (doc["ac"]["state"] == "ON");

          if (nL1 != stateL1 || nL2 != stateL2 || nFan != stateFan ||
              nAC != stateAC) {
            stateL1 = nL1;
            stateL2 = nL2;
            stateFan = nFan;
            stateAC = nAC;
            Serial.println("Cloud Sync: States Updated");
          }

          // ── UNCONDITIONAL APPLY: ──
          // Yesterday's code forcefully wrote HIGH to the relays every 1.5s.
          // This aggressively suppressed the D6 hardware boot glitch.
          // Doing this again allows D6 to work exactly like it did yesterday.
          applyRelays();

          // ── Read schedules from Firebase ──
          schedL1_on = doc["light1"]["schedule"]["on"] | "";
          schedL1_off = doc["light1"]["schedule"]["off"] | "";
          schedL2_on = doc["light2"]["schedule"]["on"] | "";
          schedL2_off = doc["light2"]["schedule"]["off"] | "";
          schedFan_on = doc["fan"]["schedule"]["on"] | "";
          schedFan_off = doc["fan"]["schedule"]["off"] | "";
          schedAC_on = doc["ac"]["schedule"]["on"] | "";
          schedAC_off = doc["ac"]["schedule"]["off"] | "";
        }
      }
      https.end();
    }

    // Heartbeat
    static unsigned long lastHB = 0;
    if (millis() - lastHB > 4000) {
      lastHB = millis();
      HTTPClient hHB;
      if (hHB.begin(*client, FIREBASE_URL_STATUS)) {
        hHB.addHeader("Content-Type", "application/json");
        hHB.sendRequest("PATCH", "{\"uptime\":" + String(millis()) + "}");
        hHB.end();
      }
    }
  }

  // 4. Schedule Check — every 10 seconds, compare NTP clock against saved
  // schedules
  if (timeReady && millis() - lastScheduleCheck > 10000) {
    lastScheduleCheck = millis();
    String now = getCurrentTime();
    checkSchedules(now);
  }

  // Retry NTP sync if it failed at boot
  if (!timeReady) {
    time_t t = time(nullptr);
    if (t > 100000) {
      timeReady = true;
      Serial.println("[NTP] Late sync OK: " + getCurrentTime());
    }
  }
}
