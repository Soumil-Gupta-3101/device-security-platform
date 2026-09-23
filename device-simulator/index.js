require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const DEVICE_ID = process.env.DEVICE_ID;
const JWT_TOKEN = process.env.JWT_TOKEN;

const EVENT_TYPES = [
  'login_attempt',
  'port_scan',
  'firmware_change',
  'location_change',
  'failed_auth'
];

/**
 * Generates a random fake IPv4 address.
 */
const randomIp = () =>
  `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 254) + 1}`;

/**
 * Generates simulated metadata appropriate for each event type.
 *
 * @param {string} eventType
 * @returns {object} metadata object
 */
const generateMetadata = (eventType) => {
  switch (eventType) {
    case 'login_attempt':
      return {
        success: Math.random() > 0.3,
        ipAddress: randomIp(),
        user: ['admin', 'operator', 'secops', 'analyst'][Math.floor(Math.random() * 4)],
        protocol: Math.random() > 0.5 ? 'SSH' : 'HTTPS'
      };

    case 'port_scan':
      return {
        sourceIp: randomIp(),
        scannedPorts: [21, 22, 23, 80, 443, 3389, 8080].filter(() => Math.random() > 0.5),
        protocol: Math.random() > 0.5 ? 'TCP' : 'UDP',
        packetsPerSecond: Math.floor(Math.random() * 500) + 100
      };

    case 'firmware_change': {
      const versions = ['1.0.4', '1.1.0', '1.2.3', '2.0.0'];
      return {
        previousVersion: versions[Math.floor(Math.random() * (versions.length - 1))],
        newVersion: versions[versions.length - 1],
        status: 'applied',
        checksum: Math.random().toString(36).substring(2, 10)
      };
    }

    case 'location_change': {
      const zones = ['Zone-A', 'Zone-B', 'Lab-3', 'Warehouse-North', 'Main-HQ'];
      return {
        previousLocation: zones[Math.floor(Math.random() * zones.length)],
        newLocation: zones[Math.floor(Math.random() * zones.length)],
        latitude: parseFloat((37.7749 + (Math.random() - 0.5) * 0.05).toFixed(4)),
        longitude: parseFloat((-122.4194 + (Math.random() - 0.5) * 0.05).toFixed(4))
      };
    }

    case 'failed_auth':
      return {
        attemptCount: Math.floor(Math.random() * 5) + 1,
        username: ['root', 'admin', 'guest', 'user1'][Math.floor(Math.random() * 4)],
        ipAddress: randomIp(),
        reason: ['invalid_credentials', 'token_expired', 'account_disabled'][Math.floor(Math.random() * 3)]
      };

    default:
      return {};
  }
};

/**
 * Sends a single simulated event to the server.
 */
const sendEvent = async () => {
  const eventType = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const metadata = generateMetadata(eventType);
  const endpoint = `${BASE_URL}/api/devices/${DEVICE_ID}/events`;

  try {
    const response = await axios.post(
      endpoint,
      { eventType, metadata },
      {
        headers: {
          Authorization: `Bearer ${JWT_TOKEN}`
        }
      }
    );

    console.log(`[${new Date().toISOString()}] Sent '${eventType}' -> Status: ${response.status}`);
  } catch (error) {
    if (error.response) {
      console.error(
        `[${new Date().toISOString()}] Failed sending '${eventType}' -> Status: ${error.response.status}, Error:`,
        error.response.data
      );
    } else {
      console.error(`[${new Date().toISOString()}] Failed sending '${eventType}' -> Error:`, error.message);
    }
  }
};

console.log('=== Device Event Simulator ===');
console.log(`Target URL : ${BASE_URL}/api/devices/${DEVICE_ID || '<DEVICE_ID>'}/events`);
console.log(`Interval   : 5 seconds`);
console.log('Press Ctrl+C to stop.\n');

if (!DEVICE_ID || !JWT_TOKEN) {
  console.warn('Warning: DEVICE_ID or JWT_TOKEN is not defined in environment variables.\n');
}

// Send initial event then schedule every 5 seconds
sendEvent();
setInterval(sendEvent, 5000);
