import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only log creation time
  }
);

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
