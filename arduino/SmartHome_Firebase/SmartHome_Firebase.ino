#include <ArduinoJson.h>
#include <ESP8266HTTPClient.h>
#include <ESP8266WiFi.h>
#include <WiFiClientSecureBearSSL.h>
#include <time.h>

#include "secrets.h"

// -------------------------------------------------------------------
// 1. YOUR CREDENTIALS (NOW HIDDEN FOR GITHUB SAFETY)
// -------------------------------------------------------------------
const char *ssid     = SECRET_SSID;
const char *password = SECRET_PASS;

// The Firebase Database URLs
const String FIREBASE_URL        = SECRET_FIREBASE_URL;
const String FIREBASE_URL_STATUS = SECRET_FIREBASE_STATUS_URL;

// -------------------------------------------------------------------
// 2. HARDWARE PINS
// -------------------------------------------------------------------
// Relays (Matched to your physical soldering!)
#define RELAY_LIGHT_1 D1 // IN1
#define RELAY_LIGHT_2 D2 // IN2
#define RELAY_FAN     D5 // IN3
#define RELAY_TV      D6 // IN4

// NOTE: Physical button pins D3 and D4 are boot-sensitive on NodeMCU.
// They go LOW during boot which caused relays to trigger automatically.
// Buttons have been disabled to fix this issue.

// -------------------------------------------------------------------
// 3. STATE VARIABLES
// -------------------------------------------------------------------
bool stateL1 = false, stateL2 = false, stateFan = false, stateTV = false;

// Schedule storage (HH:MM format, empty = no schedule)
String schedL1_on = "",  schedL1_off = "";
String schedL2_on = "",  schedL2_off = "";
String schedFan_on = "", schedFan_off = "";
String schedTV_on = "",  schedTV_off = "";

unsigned long lastUpdate       = 0;
unsigned long lastScheduleCheck = 0;
bool timeReady = false;

// Global SSL Session for lightning-fast Firebase HTTPS requests
BearSSL::Session sslSession;

// -------------------------------------------------------------------
// RELAY DRIVER
// -------------------------------------------------------------------
void applyRelays() {
  // Standard NO (Normally Open) wiring logic:
  // LOW = relay active = Device ON
  digitalWrite(RELAY_LIGHT_1, stateL1  ? LOW : HIGH);
  digitalWrite(RELAY_LIGHT_2, stateL2  ? LOW : HIGH);
  digitalWrite(RELAY_FAN,     stateFan ? LOW : HIGH);
  digitalWrite(RELAY_TV,      stateTV  ? LOW : HIGH);
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
  if (WiFi.status() != WL_CONNECTED) return;

  std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
  client->setInsecure();
  client->setSession(&sslSession);

  HTTPClient https;
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
// SCHEDULE ENGINE
// -------------------------------------------------------------------
void checkSchedules(const String &currentTime) {
  if (currentTime.length() == 0) return;

  if (schedL1_on  == currentTime && !stateL1)  { stateL1  = true;  applyRelays(); updateFirebase("light1", true); }
  if (schedL1_off == currentTime &&  stateL1)  { stateL1  = false; applyRelays(); updateFirebase("light1", false); }

  if (schedL2_on  == currentTime && !stateL2)  { stateL2  = true;  applyRelays(); updateFirebase("light2", true); }
  if (schedL2_off == currentTime &&  stateL2)  { stateL2  = false; applyRelays(); updateFirebase("light2", false); }

  if (schedFan_on  == currentTime && !stateFan) { stateFan = true;  applyRelays(); updateFirebase("fan", true); }
  if (schedFan_off == currentTime &&  stateFan) { stateFan = false; applyRelays(); updateFirebase("fan", false); }

  if (schedTV_on  == currentTime && !stateTV)  { stateTV  = true;  applyRelays(); updateFirebase("tv", true); }
  if (schedTV_off == currentTime &&  stateTV)  { stateTV  = false; applyRelays(); updateFirebase("tv", false); }
}

// -------------------------------------------------------------------
// SETUP
// -------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  // Configure Relays as OUTPUT — all start HIGH (OFF)
  pinMode(RELAY_LIGHT_1, OUTPUT);
  pinMode(RELAY_LIGHT_2, OUTPUT);
  pinMode(RELAY_FAN,     OUTPUT);
  pinMode(RELAY_TV,      OUTPUT);

  // Keep relays OFF at boot (no power draw)
  digitalWrite(RELAY_LIGHT_1, HIGH);
  digitalWrite(RELAY_LIGHT_2, HIGH);
  digitalWrite(RELAY_FAN,     HIGH);
  digitalWrite(RELAY_TV,      HIGH);

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
  Serial.println("Now communicating globally via Google Firebase Cloud!");

  // NTP Time Sync (IST = UTC+5:30)
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
  }
}

// -------------------------------------------------------------------
// MAIN LOOP
// -------------------------------------------------------------------
void loop() {
  // 1. WiFi Auto-Reconnect
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 5000) {
      delay(10);
    }
  }

  unsigned long currentMillis = millis();

  // 2. Cloud (Firebase) Polling every 2 seconds
  if (currentMillis - lastUpdate > 2000) {
    lastUpdate = currentMillis;

    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure();
    client->setSession(&sslSession);

    HTTPClient https;
    if (https.begin(*client, FIREBASE_URL)) {
      int code = https.GET();
      if (code == HTTP_CODE_OK) {
        String payload = https.getString();
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, payload);

        if (!err) {
          stateL1  = (doc["light1"]["state"] == "ON");
          stateL2  = (doc["light2"]["state"] == "ON");
          stateFan = (doc["fan"]["state"]    == "ON");
          stateTV  = (doc["tv"]["state"]     == "ON");
          applyRelays();

          // Read schedules
          schedL1_on   = doc["light1"]["schedule"]["on"]  | "";
          schedL1_off  = doc["light1"]["schedule"]["off"] | "";
          schedL2_on   = doc["light2"]["schedule"]["on"]  | "";
          schedL2_off  = doc["light2"]["schedule"]["off"] | "";
          schedFan_on  = doc["fan"]["schedule"]["on"]     | "";
          schedFan_off = doc["fan"]["schedule"]["off"]    | "";
          schedTV_on   = doc["tv"]["schedule"]["on"]      | "";
          schedTV_off  = doc["tv"]["schedule"]["off"]     | "";
        }
      }
      https.end();
    }

    // 3. Heartbeat Pulse
    static unsigned long lastHB = 0;
    if (currentMillis - lastHB > 4000) {
      lastHB = currentMillis;
      HTTPClient httpsHB;
      if (httpsHB.begin(*client, FIREBASE_URL_STATUS)) {
        httpsHB.addHeader("Content-Type", "application/json");
        httpsHB.sendRequest("PATCH", "{\"uptime\":" + String(currentMillis) + "}");
        httpsHB.end();
      }
    }
  }

  // 4. Schedule Check every 10 seconds
  if (timeReady && currentMillis - lastScheduleCheck > 10000) {
    lastScheduleCheck = currentMillis;
    checkSchedules(getCurrentTime());
  }

  if (!timeReady && (time(nullptr) > 100000)) {
    timeReady = true;
  }
}
