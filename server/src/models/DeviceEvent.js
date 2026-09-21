const mongoose = require('mongoose');

const deviceEventSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required']
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

// Compound index for querying recent events for a device in descending order
deviceEventSchema.index({ device: 1, timestamp: -1 });

const DeviceEvent = mongoose.model('DeviceEvent', deviceEventSchema);

module.exports = DeviceEvent;
