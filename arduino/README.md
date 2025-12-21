# Arduino RFID RC522 Setup Guide

This guide will help you connect your Arduino Uno with RFID RC522 module to the IT Inventory Management System.

## Hardware Requirements

- Arduino Uno (or compatible)
- RFID RC522 Module
- Jumper wires
- USB cable to connect Arduino to computer

## Hardware Connections

Connect the RFID RC522 module to Arduino Uno as follows:

| RC522 Pin | Arduino Pin |
|-----------|-------------|
| SDA       | Digital Pin 10 |
| SCK       | Digital Pin 13 |
| MOSI      | Digital Pin 11 |
| MISO      | Digital Pin 12 |
| RST       | Digital Pin 9 |
| 3.3V      | 3.3V |
| GND       | GND |

**Important:** The RC522 module requires 3.3V power. Do NOT connect it to 5V as it may damage the module.

## Software Setup

### Step 1: Install Arduino IDE

1. Download and install Arduino IDE 2.3.7 or later from [arduino.cc](https://www.arduino.cc/en/software)
2. Open Arduino IDE

### Step 2: Install Required Library

1. In Arduino IDE, go to **Tools** → **Manage Libraries**
2. Search for **"MFRC522"** by GithubCommunity
3. Click **Install** on the library

### Step 3: Upload the Sketch

1. Open `rfid_reader.ino` in Arduino IDE
2. Select your board: **Tools** → **Board** → **Arduino Uno**
3. Select your port: **Tools** → **Port** → Select your Arduino's COM port
4. Click **Upload** (or press Ctrl+U)

### Step 4: Test the Connection

1. Open **Tools** → **Serial Monitor**
2. Set baud rate to **9600**
3. Place an RFID tag near the RC522 module
4. You should see the tag UID printed in the Serial Monitor

## Web Application Connection

### Option 1: Web Serial API (Recommended for Chrome/Edge)

1. Open the RFID Scanner page in **Chrome** or **Edge** browser
2. Click **"Connect to Arduino"** button
3. Select your Arduino's COM port from the popup
4. The connection status will show "✓ Connected to Arduino"
5. Now when you scan an RFID tag, it will automatically search for the asset

**Note:** Web Serial API is only supported in Chrome, Edge, and Opera browsers.

### Option 2: Manual Entry

1. Scan an RFID tag using the Arduino
2. Copy the UID from Serial Monitor
3. Paste it into the RFID Tag ID field on the web page
4. Click "Search Asset"

## Troubleshooting

### Arduino not detected
- Check USB cable connection
- Try a different USB port
- Install Arduino USB drivers if needed

### No tag detected
- Move the tag closer to the RC522 module (within 5cm)
- Check all wire connections
- Verify the module is powered (LED should be on)
- Try a different RFID tag

### Web Serial API not working
- Make sure you're using Chrome, Edge, or Opera browser
- Check that the Arduino is connected and the sketch is uploaded
- Try disconnecting and reconnecting
- Check browser console for error messages

### Wrong tag UID format
- The system expects hexadecimal UID (8-16 characters)
- Make sure the Arduino sketch is sending the UID correctly
- Check Serial Monitor to verify the output format

## Arduino Sketch Details

The sketch (`rfid_reader.ino`) does the following:
- Initializes the MFRC522 RFID reader
- Continuously scans for RFID tags
- Sends the tag UID via Serial communication (9600 baud)
- Includes debouncing to prevent duplicate scans
- Sends status messages for debugging

## Security Note

The RFID tag UID is sent as plain text over Serial communication. For production use, consider:
- Using encrypted communication
- Implementing authentication
- Using HTTPS for the web application

