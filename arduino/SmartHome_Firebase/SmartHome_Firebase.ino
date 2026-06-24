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
// Relays (Matched to your physical soldering!)
#define RELAY_LIGHT_1 D1 // IN1
#define RELAY_LIGHT_2 D2 // IN2
#define RELAY_FAN     D5 // IN3
#define RELAY_TV      D6 // IN4

// Physical Wall Switches (Assigned to remaining pins)
#define BTN_LIGHT_1   D7 
#define BTN_LIGHT_2   D3 // (Note: Switch must be open/off during boot)
#define BTN_FAN       D4 // (Note: Switch must be open/off during boot)
#define BTN_TV        3  // RX Pin

// -------------------------------------------------------------------
// 3. STATE VARIABLES
// -------------------------------------------------------------------
bool stateL1 = false, stateL2 = false, stateFan = false, stateTV = false;

// We will read the initial state of the pins in setup()
bool lastBtnL1 = HIGH, lastBtnL2 = HIGH, lastBtnFan = HIGH, lastBtnTV = HIGH;

// Independent debounce timers
unsigned long lastDebounceL1 = 0;
unsigned long lastDebounceL2 = 0;
unsigned long lastDebounceFan = 0;
unsigned long lastDebounceTV = 0;

// Schedule storage (HH:MM format, empty = no schedule)
String schedL1_on = "", schedL1_off = "";
String schedL2_on = "", schedL2_off = "";
String schedFan_on = "", schedFan_off = "";
String schedTV_on = "", schedTV_off = "";

unsigned long lastUpdate = 0;
unsigned long lastManualUpdate = 0; // Prevent cloud from immediately overriding a physical press
unsigned long lastScheduleCheck = 0;
bool timeReady = false;

// Global SSL Session for lightning-fast Firebase HTTPS requests
BearSSL::Session sslSession;

// -------------------------------------------------------------------
// RELAY DRIVER
// -------------------------------------------------------------------
void applyRelays() {
  digitalWrite(RELAY_LIGHT_1, stateL1 ? LOW : HIGH);
  digitalWrite(RELAY_LIGHT_2, stateL2 ? LOW : HIGH);
  digitalWrite(RELAY_FAN, stateFan ? LOW : HIGH);
  digitalWrite(RELAY_TV, stateTV ? LOW : HIGH);
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
  client->setSession(&sslSession); // Use cached SSL session for speed!
  
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

  if (schedL1_on == currentTime && !stateL1) { stateL1 = true; applyRelays(); updateFirebase("light1", true); }
  if (schedL1_off == currentTime && stateL1) { stateL1 = false; applyRelays(); updateFirebase("light1", false); }

  if (schedL2_on == currentTime && !stateL2) { stateL2 = true; applyRelays(); updateFirebase("light2", true); }
  if (schedL2_off == currentTime && stateL2) { stateL2 = false; applyRelays(); updateFirebase("light2", false); }

  if (schedFan_on == currentTime && !stateFan) { stateFan = true; applyRelays(); updateFirebase("fan", true); }
  if (schedFan_off == currentTime && stateFan) { stateFan = false; applyRelays(); updateFirebase("fan", false); }

  if (schedTV_on == currentTime && !stateTV) { stateTV = true; applyRelays(); updateFirebase("tv", true); }
  if (schedTV_off == currentTime && stateTV) { stateTV = false; applyRelays(); updateFirebase("tv", false); }
}

// -------------------------------------------------------------------
// SETUP
// -------------------------------------------------------------------
void setup() {
  Serial.begin(115200);

  // Configure Relays
  pinMode(RELAY_LIGHT_1, OUTPUT);
  pinMode(RELAY_LIGHT_2, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  pinMode(RELAY_TV, OUTPUT);

  digitalWrite(RELAY_LIGHT_1, HIGH);
  digitalWrite(RELAY_LIGHT_2, HIGH);
  digitalWrite(RELAY_FAN, HIGH);
  digitalWrite(RELAY_TV, HIGH);

  // Configure Buttons
  pinMode(BTN_LIGHT_1, INPUT_PULLUP);
  pinMode(BTN_LIGHT_2, INPUT_PULLUP);
  pinMode(BTN_FAN, INPUT_PULLUP);
  pinMode(BTN_TV, INPUT_PULLUP);
  
  // Read initial physical switch states
  lastBtnL1 = digitalRead(BTN_LIGHT_1);
  lastBtnL2 = digitalRead(BTN_LIGHT_2);
  lastBtnFan = digitalRead(BTN_FAN);
  lastBtnTV = digitalRead(BTN_TV);

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

  applyRelays();

  // NTP Time Sync
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
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000) { delay(10); }
  }

  // 2. Physical Switch Polling (State-Change Logic for Wall Switches)
  unsigned long currentMillis = millis();

  bool b1 = digitalRead(BTN_LIGHT_1);
  if (b1 != lastBtnL1 && (currentMillis - lastDebounceL1 > 150)) {
    lastDebounceL1 = currentMillis;
    lastBtnL1 = b1;
    stateL1 = !stateL1; // Toggle on ANY flip direction
    applyRelays();
    lastManualUpdate = currentMillis;
    updateFirebase("light1", stateL1);
    Serial.println("Manual: Light 1 Toggled");
  }

  bool b2 = digitalRead(BTN_LIGHT_2);
  if (b2 != lastBtnL2 && (currentMillis - lastDebounceL2 > 150)) {
    lastDebounceL2 = currentMillis;
    lastBtnL2 = b2;
    stateL2 = !stateL2;
    applyRelays();
    lastManualUpdate = currentMillis;
    updateFirebase("light2", stateL2);
    Serial.println("Manual: Light 2 Toggled");
  }

  bool bf = digitalRead(BTN_FAN);
  if (bf != lastBtnFan && (currentMillis - lastDebounceFan > 150)) {
    lastDebounceFan = currentMillis;
    lastBtnFan = bf;
    stateFan = !stateFan;
    applyRelays();
    lastManualUpdate = currentMillis;
    updateFirebase("fan", stateFan);
    Serial.println("Manual: Fan Toggled");
  }

  bool ba = digitalRead(BTN_TV);
  if (ba != lastBtnTV && (currentMillis - lastDebounceTV > 150)) {
    lastDebounceTV = currentMillis;
    lastBtnTV = ba;
    stateTV = !stateTV;
    applyRelays();
    lastManualUpdate = currentMillis;
    updateFirebase("tv", stateTV);
    Serial.println("Manual: TV Toggled");
  }

  // 3. Cloud (Firebase) Polling
  // Only poll if no manual toggle happened in the last 2 seconds (Conflict Resolution)
  if (currentMillis - lastUpdate > 2000 && currentMillis - lastManualUpdate > 2000) {
    lastUpdate = currentMillis;
    
    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure();
    client->setSession(&sslSession); // Cached SSL session
    
    HTTPClient https;
    if (https.begin(*client, FIREBASE_URL)) {
      int code = https.GET();
      if (code == HTTP_CODE_OK) {
        String payload = https.getString();
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, payload);

        if (!err) {
          bool nL1 = (doc["light1"]["state"] == "ON");
          bool nL2 = (doc["light2"]["state"] == "ON");
          bool nFan = (doc["fan"]["state"] == "ON");
          bool nTV = (doc["tv"]["state"] == "ON");

          if (nL1 != stateL1 || nL2 != stateL2 || nFan != stateFan || nTV != stateTV) {
            stateL1 = nL1; stateL2 = nL2; stateFan = nFan; stateTV = nTV;
            applyRelays();
            Serial.println("Cloud Sync: States Updated");
          }
          applyRelays(); // Unconditional apply to fix D6 hardware glitch

          schedL1_on = doc["light1"]["schedule"]["on"] | "";
          schedL1_off = doc["light1"]["schedule"]["off"] | "";
          schedL2_on = doc["light2"]["schedule"]["on"] | "";
          schedL2_off = doc["light2"]["schedule"]["off"] | "";
          schedFan_on = doc["fan"]["schedule"]["on"] | "";
          schedFan_off = doc["fan"]["schedule"]["off"] | "";
          schedTV_on = doc["tv"]["schedule"]["on"] | "";
          schedTV_off = doc["tv"]["schedule"]["off"] | "";
        }
      }
      https.end();
    }

    // Heartbeat
    static unsigned long lastHB = 0;
    if (currentMillis - lastHB > 4000) {
      lastHB = currentMillis;
      HTTPClient hHB;
      if (hHB.begin(*client, FIREBASE_URL_STATUS)) {
        hHB.addHeader("Content-Type", "application/json");
        hHB.sendRequest("PATCH", "{\"uptime\":" + String(currentMillis) + "}");
        hHB.end();
      }
    }
  }

  // 4. Schedule Check
  if (timeReady && currentMillis - lastScheduleCheck > 10000) {
    lastScheduleCheck = currentMillis;
    checkSchedules(getCurrentTime());
  }

  if (!timeReady && (time(nullptr) > 100000)) {
    timeReady = true;
  }
}
