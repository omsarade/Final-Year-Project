#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>

#include "secrets.h"

// -------------------------------------------------------------------
// 1. YOUR CREDENTIALS (NOW HIDDEN FOR GITHUB SAFETY)
// -------------------------------------------------------------------
const char* ssid     = SECRET_SSID;
const char* password = SECRET_PASS;

// The Firebase Database URLs
const String FIREBASE_URL        = SECRET_FIREBASE_URL;
const String FIREBASE_URL_STATUS = SECRET_FIREBASE_STATUS_URL;

// -------------------------------------------------------------------
// 2. HARDWARE PINS
// -------------------------------------------------------------------
#define RELAY_LIGHT_1 D1 // GPIO5
#define RELAY_LIGHT_2 D2 // GPIO4
#define RELAY_FAN     D5 // GPIO14
#define RELAY_AC      D6 // GPIO12

unsigned long lastUpdate = 0;

void setup() {
  Serial.begin(115200);

  // Configure Pins
  pinMode(RELAY_LIGHT_1, OUTPUT);
  pinMode(RELAY_LIGHT_2, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  pinMode(RELAY_AC, OUTPUT);

  // Relays are active LOW (HIGH means OFF)
  digitalWrite(RELAY_LIGHT_1, HIGH);
  digitalWrite(RELAY_LIGHT_2, HIGH);
  digitalWrite(RELAY_FAN, HIGH);
  digitalWrite(RELAY_AC, HIGH);

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
}

void loop() {
  // Auto-Reconnect
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 5000) {
      delay(10);
    }
  }

  // Poll Firebase every 1.5 seconds (Fast enough for real-time feel)
  if (millis() - lastUpdate > 1500) {
    lastUpdate = millis();

    // Setup Secure Client for HTTPS
    std::unique_ptr<BearSSL::WiFiClientSecure> client(new BearSSL::WiFiClientSecure);
    client->setInsecure(); // Ignore SSL certificate verification for simplicity

    HTTPClient https;
    
    // Connect to Firebase to read Relay States
    if (https.begin(*client, FIREBASE_URL)) {
      int httpCode = https.GET();

      if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_MOVED_PERMANENTLY) {
          String payload = https.getString();
          
          if (payload != "null") {
            // Simple robust string search matching the exact React output
            bool l1  = payload.indexOf("\"light1\":{\"state\":\"ON\"") != -1;
            bool l2  = payload.indexOf("\"light2\":{\"state\":\"ON\"") != -1;
            bool fan = payload.indexOf("\"fan\":{\"state\":\"ON\"") != -1;
            bool ac  = payload.indexOf("\"ac\":{\"state\":\"ON\"") != -1;

            // Apply physical state
            digitalWrite(RELAY_LIGHT_1, l1 ? LOW : HIGH);
            digitalWrite(RELAY_LIGHT_2, l2 ? LOW : HIGH);
            digitalWrite(RELAY_FAN, fan ? LOW : HIGH);
            digitalWrite(RELAY_AC, ac ? LOW : HIGH);
          }
        }
      }
      https.end();
    }

    // --- 2. Write Heartbeat Pulse ---
    static unsigned long lastHeartbeat = 0;
    if (millis() - lastHeartbeat > 4000) {
      lastHeartbeat = millis();
      
      HTTPClient httpsHB;
      if (httpsHB.begin(*client, FIREBASE_URL_STATUS)) {
        httpsHB.addHeader("Content-Type", "application/json");
        String payload = "{\"uptime\":" + String(millis()) + "}";
        httpsHB.sendRequest("PATCH", payload);
        httpsHB.end();
      }
    }
  }
}
