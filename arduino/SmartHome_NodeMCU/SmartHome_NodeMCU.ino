#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

// -------------------------------------------------------------------
// 1. UPDATE YOUR WIFI CREDENTIALS HERE
// -------------------------------------------------------------------
const char* ssid     = "S20FE";
const char* password = "GalaxyOm";

// -------------------------------------------------------------------
// 2. DEFINE YOUR 4-CHANNEL RELAY PINS (ESP8266 NodeMCU)
// -------------------------------------------------------------------
// Note: Depending on your board, D1, D2, etc. map to specific GPIOs
#define RELAY_LIGHT_1 D1 // GPIO5 (Safe)
#define RELAY_LIGHT_2 D2 // GPIO4 (Safe)
#define RELAY_FAN     D5 // GPIO14 (Safe - Moved from boot-sensitive D3)
#define RELAY_AC      D6 // GPIO12 (Safe - Moved from boot-sensitive D4)

// Create WebServer object on port 80
ESP8266WebServer server(80);

// Helper function to send CORS headers so the React app can talk to it
void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void setup() {
  Serial.begin(115200);
  delay(100);

  // Configure Relay Pins as OUTPUT
  pinMode(RELAY_LIGHT_1, OUTPUT);
  pinMode(RELAY_LIGHT_2, OUTPUT);
  pinMode(RELAY_FAN, OUTPUT);
  pinMode(RELAY_AC, OUTPUT);

  // Set initial state (Most 4-channel relays are Active LOW, so HIGH means OFF)
  // If your relays turn ON when you want them OFF, change HIGH to LOW here.
  digitalWrite(RELAY_LIGHT_1, HIGH); 
  digitalWrite(RELAY_LIGHT_2, HIGH);
  digitalWrite(RELAY_FAN, HIGH);
  digitalWrite(RELAY_AC, HIGH);

  // Connect to WiFi
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected!");
  Serial.print("NodeMCU IP Address: ");
  Serial.println(WiFi.localIP()); 
  // IMPORTANT: Copy this IP address into src/services/deviceApi.js -> NODEMCU_IP!

  // -------------------------------------------------------------------
  // 3. DEFINE API ENDPOINTS
  // -------------------------------------------------------------------

  // Handle preflight requests for CORS
  server.on("/", HTTP_OPTIONS, []() {
    sendCORSHeaders();
    server.send(204);
  });
  
  server.on("/control", HTTP_OPTIONS, []() {
    sendCORSHeaders();
    server.send(204);
  });

  server.on("/status", HTTP_OPTIONS, []() {
    sendCORSHeaders();
    server.send(204);
  });

  // GET /status endpoint: Returns current ON/OFF status of all relays
  server.on("/status", HTTP_GET, []() {
    sendCORSHeaders();
    
    // Remember Active LOW: digitalRead LOW means it's ON.
    String l1 = (digitalRead(RELAY_LIGHT_1) == LOW) ? "ON" : "OFF";
    String l2 = (digitalRead(RELAY_LIGHT_2) == LOW) ? "ON" : "OFF";
    String fan = (digitalRead(RELAY_FAN) == LOW) ? "ON" : "OFF";
    String ac = (digitalRead(RELAY_AC) == LOW) ? "ON" : "OFF";

    String json = "{";
    json += "\"light1\":\"" + l1 + "\",";
    json += "\"light2\":\"" + l2 + "\",";
    json += "\"fan\":\"" + fan + "\",";
    json += "\"ac\":\"" + ac + "\"";
    json += "}";

    server.send(200, "application/json", json);
  });

  // Main HTTP GET endpoint: http://<NODE_IP>/control?device=light1&state=ON
  server.on("/control", HTTP_GET, []() {
    sendCORSHeaders();

    if (!server.hasArg("device") || !server.hasArg("state")) {
      server.send(400, "application/json", "{\"error\":\"Missing arguments\"}");
      return;
    }

    String device = server.arg("device");
    String stateStr = server.arg("state");
    
    // Convert ON/OFF to physical HIGH/LOW
    // (Active LOW relay module: LOW = ON, HIGH = OFF)
    int physicalState = (stateStr == "ON") ? LOW : HIGH;

    // Match the React UI IDs to physical pins
    if (device == "light1") {
      digitalWrite(RELAY_LIGHT_1, physicalState);
    } 
    else if (device == "light2") {
      digitalWrite(RELAY_LIGHT_2, physicalState);
    } 
    else if (device == "fan") {
      digitalWrite(RELAY_FAN, physicalState);
    } 
    else if (device == "ac") {
      digitalWrite(RELAY_AC, physicalState);
    } 
    else {
      // If a dynamic component was added, just print it for now
      Serial.print("Received unknown device command: ");
      Serial.println(device);
      server.send(404, "application/json", "{\"error\":\"Unknown device\"}");
      return;
    }

    Serial.print("Device [");
    Serial.print(device);
    Serial.print("] turned ");
    Serial.println(stateStr);

    String jsonResponse = "{\"success\":true,\"device\":\"" + device + "\",\"state\":\"" + stateStr + "\"}";
    server.send(200, "application/json", jsonResponse);
  });

  // Start the server
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  // 1. WiFi Auto-Reconnect Logic
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost. Reconnecting...");
    WiFi.reconnect();
    unsigned long startAttemptTime = millis();
    // Non-blocking wait for 5 seconds
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 5000) {
      delay(10);
    }
  }

  // 2. Listen for incoming HTTP client requests
  server.handleClient();
}
