const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true
    },
    ipAddress: {
      type: String,
      required: [true, 'IP address is required'],
      trim: true
    },
    macAddress: {
      type: String,
      trim: true
    },
    deviceType: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['trusted', 'unknown', 'suspicious', 'blocked'],
        message: '{VALUE} is not a valid device status'
      },
      default: 'unknown',
      index: true
    },
    riskScore: {
      type: Number,
      default: 0,
      min: [0, 'Risk score cannot be less than 0'],
      max: [100, 'Risk score cannot exceed 100'],
      index: true
    },
    lastSeen: {
      type: Date
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

// Explicit compound index for common dashboard queries filtering status and sorting by risk
deviceSchema.index({ status: 1, riskScore: -1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
