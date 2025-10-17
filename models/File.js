const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: String,
    size: Number,
    status: {
      type: String,
      enum: ["uploaded", "processing", "processed", "failed"],
      default: "uploaded",
    },
    program: {
      type: String,
      enum: ["mozaik", "vcarve", "fusion360", "other"],
      required: true,
    },
    detectedVersion: String,
    metadata: mongoose.Schema.Types.Mixed,
    identifiedIssues: [
      {
        code: String,
        description: String,
        severity: {
          type: String,
          enum: ["info", "warning", "error"],
        },
        suggestedFix: String,
      },
    ],
    processingError: String,
  },
  {
    timestamps: true,
  }
);

fileSchema.index({ user: 1, createdAt: -1 });
fileSchema.index({ status: 1 });
fileSchema.index({ program: 1 });

module.exports = mongoose.model("File", fileSchema);
