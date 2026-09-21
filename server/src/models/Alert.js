const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Note author is required']
    },
    text: {
      type: String,
      required: [true, 'Note text is required'],
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: true
  }
);

const alertSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required']
    },
    severity: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: '{VALUE} is not a valid severity level'
      },
      required: [true, 'Severity is required']
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'investigating', 'resolved'],
        message: '{VALUE} is not a valid alert status'
      },
      default: 'open'
    },
    notes: [noteSchema],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

// Compound index for dashboard filtering by status and severity
alertSchema.index({ status: 1, severity: 1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
