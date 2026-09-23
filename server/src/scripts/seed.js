const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Device = require('../models/Device');

const seedData = async () => {
  try {
    console.log('Connecting to database...');
    await connectDB();

    console.log('Clearing existing Users and Devices...');
    await User.deleteMany({});
    await Device.deleteMany({});

    console.log('Creating users...');
    const users = await User.insertMany([
      {
        name: 'Alex Rivera',
        email: 'admin@security.local',
        passwordHash: 'placeholder_hash_admin_123',
        role: 'admin'
      },
      {
        name: 'Jordan Chen',
        email: 'analyst@security.local',
        passwordHash: 'placeholder_hash_analyst_456',
        role: 'analyst'
      },
      {
        name: 'Sam Taylor',
        email: 'viewer@security.local',
        passwordHash: 'placeholder_hash_viewer_789',
        role: 'viewer'
      }
    ]);

    const [adminUser, analystUser, viewerUser] = users;
    console.log(`✓ Inserted ${users.length} users (admin, analyst, viewer).`);

    console.log('Creating devices...');
    const devices = await Device.insertMany([
      {
        name: 'HQ-Core-Router',
        ipAddress: '192.168.1.1',
        macAddress: '00:1A:2B:3C:4D:5E',
        deviceType: 'server',
        status: 'trusted',
        riskScore: 5,
        lastSeen: new Date(),
        owner: adminUser._id
      },
      {
        name: 'SecOps-Workstation',
        ipAddress: '192.168.1.45',
        macAddress: 'A4:83:E7:22:11:00',
        deviceType: 'laptop',
        status: 'trusted',
        riskScore: 12,
        lastSeen: new Date(),
        owner: analystUser._id
      },
      {
        name: 'Guest-Mobile-Phone',
        ipAddress: '192.168.2.110',
        macAddress: '3C:22:FB:88:99:AA',
        deviceType: 'mobile',
        status: 'unknown',
        riskScore: 45,
        lastSeen: new Date(Date.now() - 60 * 60 * 1000),
        owner: viewerUser._id
      },
      {
        name: 'Warehouse-Thermal-Sensor',
        ipAddress: '10.0.4.12',
        macAddress: 'B8:27:EB:12:34:56',
        deviceType: 'iot',
        status: 'suspicious',
        riskScore: 78,
        lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000),
        owner: analystUser._id
      },
      {
        name: 'Rogue-AP-Dongle',
        ipAddress: '192.168.1.250',
        macAddress: '00:0C:29:FE:44:19',
        deviceType: 'server',
        status: 'blocked',
        riskScore: 95,
        lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000),
        owner: adminUser._id
      },
      {
        name: 'Finance-MacBook-Pro',
        ipAddress: '192.168.1.78',
        macAddress: 'F0:18:98:D1:E2:B3',
        deviceType: 'laptop',
        status: 'trusted',
        riskScore: 18,
        lastSeen: new Date(),
        owner: viewerUser._id
      }
    ]);

    console.log(`✓ Inserted ${devices.length} devices.`);
    console.log('\n--- Seed Summary ---');
    console.log(`Users (${users.length}):`);
    users.forEach(u => console.log(`  - [${u.role.toUpperCase()}] ${u.name} (${u.email})`));
    console.log(`\nDevices (${devices.length}):`);
    devices.forEach(d => console.log(`  - [${d.status.toUpperCase()}] ${d.name} (${d.ipAddress}) | Risk: ${d.riskScore}`));

    await mongoose.disconnect();
    console.log('\nDatabase disconnected cleanly. Seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
  }
};

seedData();
