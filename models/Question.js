const mongoose = require("mongoose");
const slugify = require("slugify");

const questionSchema = new mongoose.Schema(
  {
    canonicalId: {
      type: String,
      required: true,
      unique: true,
    },
    originalQuestion: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },
    version: {
      type: String,
      index: true,
    },
    answer: {
      type: String,
      required: true,
    },
    modelUsed: {
      type: String,
      required: true,
      enum: ["gpt-4o-mini", "gpt-4o", "cache"],
    },
    tokensUsed: {
      prompt: Number,
      completion: Number,
    },
    sources: [String],
    popularity: {
      type: Number,
      default: 0,
      index: true,
    },
    ups: {
      type: Number,
      default: 0,
    },
    downs: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      default: 0,
    },
    published: {
      type: Boolean,
      default: false,
    },
    publishedUrl: {
      type: String,
      sparse: true,
    },
    seoTitle: String,
    seoDescription: String,
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ platform: 1, version: 1 });
questionSchema.index({ score: -1 });
questionSchema.index({ popularity: -1 });
questionSchema.index({ published: 1 });

questionSchema.pre("save", function (next) {
  this.score = this.ups - this.downs;
  this.lastUpdated = new Date();

  if (this.isModified("answer") && this.published) {
    this.published = false;
    this.publishedUrl = undefined;
  }
  next();
});

questionSchema.statics.findByQuestion = function (
  questionText,
  platform,
  version
) {
  const baseSlug = slugify(questionText, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
  const platformSlug = slugify(platform, { lower: true, strict: true });
  const versionSlug = version
    ? slugify(version, { lower: true, strict: true })
    : "generic";
  const canonicalId = `${platformSlug}:${versionSlug}:${baseSlug}`;
  return this.findOne({ canonicalId });
};

questionSchema.statics.createFromQuestion = function (
  questionText,
  platform,
  version,
  answer,
  modelUsed,
  tokens,
  sources
) {
  const baseSlug = slugify(questionText, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
  const platformSlug = slugify(platform, { lower: true, strict: true });
  const versionSlug = version
    ? slugify(version, { lower: true, strict: true })
    : "generic";
  const canonicalId = `${platformSlug}:${versionSlug}:${baseSlug}`;

  return this.create({
    canonicalId,
    originalQuestion: questionText,
    platform: platformSlug,
    version: versionSlug,
    answer,
    modelUsed,
    tokensUsed: tokens,
    sources: sources || [],
    popularity: 1,
  });
};

module.exports = mongoose.model("Question", questionSchema);
