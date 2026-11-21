const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Device = require('../src/models/Device');
const DeviceEvent = require('../src/models/DeviceEvent');

const backfillFirstSeen = async () => {
  const mongoUri = process.env.DATABASE_URL;

  if (!mongoUri) {
    console.error('Error: DATABASE_URL is not defined in environment variables.');
    process.exit(1);
  }

  try {
    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.\n');

    const devices = await Device.find();
    console.log(`Found ${devices.length} device(s) to inspect.`);

    let updatedCount = 0;
    let alreadySetCount = 0;
    let noEventsCount = 0;

    for (const device of devices) {
      if (device.firstSeen) {
        alreadySetCount++;
        continue;
      }

      // Find earliest event for this device
      const earliestEvent = await DeviceEvent.findOne({ device: device._id })
        .sort({ timestamp: 1 })
        .lean();

      if (earliestEvent) {
        const firstSeenTimestamp = earliestEvent.timestamp || earliestEvent.createdAt;
        await Device.findByIdAndUpdate(device._id, { firstSeen: firstSeenTimestamp });
        console.log(
          `[Updated] Device "${device.name}" (${device._id}) -> firstSeen set to ${new Date(firstSeenTimestamp).toISOString()}`
        );
        updatedCount++;
      } else {
        noEventsCount++;
      }
    }

    console.log('\n=== Backfill Summary ===');
    console.log(`Total devices inspected : ${devices.length}`);
    console.log(`Devices updated         : ${updatedCount}`);
    console.log(`Already had firstSeen   : ${alreadySetCount}`);
    console.log(`Devices with no events  : ${noEventsCount}`);
    console.log('Backfill completed successfully.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Backfill error:', error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
};

backfillFirstSeen();

