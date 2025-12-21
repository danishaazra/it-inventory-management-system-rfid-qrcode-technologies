/*
 * RFID Reader for IT Inventory Management System
 * Arduino Uno + RFID RC522
 * 
 * This sketch reads RFID tags and sends the UID via Serial communication
 * to the web application.
 * 
 * Connections:
 * RC522    -> Arduino Uno
 * SDA      -> Digital Pin 10
 * SCK      -> Digital Pin 13
 * MOSI     -> Digital Pin 11
 * MISO     -> Digital Pin 12
 * RST      -> Digital Pin 9
 * 3.3V     -> 3.3V
 * GND      -> GND
 * 
 * Required Library: MFRC522 by GithubCommunity
 * Install via: Tools -> Manage Libraries -> Search "MFRC522"
 */

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10    // SDA pin
#define RST_PIN 9    // RST pin

MFRC522 mfrc522(SS_PIN, RST_PIN);  // Create MFRC522 instance

String lastCardUID = "";  // Store last scanned card to avoid duplicates
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_TIME = 1000;  // Wait 1 second before accepting same card again

void setup() {
  Serial.begin(9600);  // Initialize serial communication at 9600 baud
  while (!Serial);     // Wait for serial port to connect (needed for some boards)
  
  SPI.begin();         // Initialize SPI bus
  mfrc522.PCD_Init();  // Initialize MFRC522
  
  // Optional: Increase antenna gain for better range
  mfrc522.PCD_SetAntennaGain(mfrc522.RxGain_max);
  
  Serial.println("RFID Reader Ready");
  Serial.println("Waiting for RFID tag...");
  Serial.println("---");  // Separator for web app to detect ready state
}

void loop() {
  // Check if a new card is present
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  
  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  
  // Get current time for debouncing
  unsigned long currentTime = millis();
  
  // Read card UID
  String cardUID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      cardUID += "0";
    }
    cardUID += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUID.toUpperCase();
  
  // Debounce: Only send if it's a different card or enough time has passed
  if (cardUID != lastCardUID || (currentTime - lastScanTime) > DEBOUNCE_TIME) {
    lastCardUID = cardUID;
    lastScanTime = currentTime;
    
    // Send UID to serial port (web app will read this)
    Serial.println(cardUID);
    
    // Optional: Print to Serial Monitor for debugging
    Serial.print("RFID Tag Scanned: ");
    Serial.println(cardUID);
  }
  
  // Halt PICC (stop reading the card)
  mfrc522.PICC_HaltCard();
  // Stop encryption on PCD
  mfrc522.PCD_StopCrypto1();
  
  // Small delay before next scan
  delay(100);
}

