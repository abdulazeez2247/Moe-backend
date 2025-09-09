const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)@\w+([.-]?\w+)(.\w{2,})+$/,
        'Please provide a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false
    },
    plan: {
      type: String,
      enum: ['trial', 'free', 'hobby', 'occ', 'pro', 'ent'],
      default: 'trial'
    },
    customerId: {
      type: String,
      default: null
    },
    subscriptionId: {
      type: String,
      default: null
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'canceled', 'past_due', null],
      default: null
    },
    monthlyUsed: {
      type: Number,
      default: 0
    },
    monthlyResetAt: {
      type: Date,
      default: () =>
        new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth() + 1,
            1
          )
        )
    },
    dailyUsed: {
      type: Number,
      default: 0
    },
    dailyResetAt: {
      type: Date,
      default: Date.now
    },
    trialQuestionsUsed: {
      type: Number,
      default: 0
    },
    trialExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    fingerprintHashes: [
      {
        type: String,
        select: false
      }
    ],
    assistantMessageCount: {
      type: Number,
      default: 0
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    seesAds: {
      type: Boolean,
      default: true
    },
    passwordChangedAt: {
      type: Date,
      select: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ plan: 1 });
userSchema.index({ monthlyResetAt: 1 });
userSchema.index({ fingerprintHashes: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.incrementUsage = function () {
  const now = new Date();

  if (!this.dailyResetAt || now.toDateString() !== this.dailyResetAt.toDateString()) {
    this.dailyUsed = 0;
    this.dailyResetAt = now;
  }

  if (!this.monthlyResetAt || now >= this.monthlyResetAt) {
    const nextUTCMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    );
    this.monthlyUsed = 0;
    this.monthlyResetAt = nextUTCMonth;
  }

  if (this.plan === 'trial') {
    this.trialQuestionsUsed += 1;
  }

  this.dailyUsed += 1;
  this.monthlyUsed += 1;
  this.lastSeen = now;
};

userSchema.methods.canAskQuestion = function () {
  const now = new Date();
  
  if (this.plan === 'trial') {
    if (this.trialQuestionsUsed >= 5) {
      return { canAsk: false, reason: 'Trial questions exhausted' };
    }
    if (now > this.trialExpiresAt) {
      return { canAsk: false, reason: 'Trial period expired' };
    }
    return { canAsk: true };
  }
  
  if (this.plan === 'free') {
    const dailyLimit = 5;
    if (this.dailyUsed >= dailyLimit) {
      return { canAsk: false, reason: 'Daily limit reached' };
    }
    return { canAsk: true };
  }
  
  return { canAsk: true };
};

userSchema.methods.canUploadFile = function () {
  if (this.plan === 'free' || this.plan === 'trial') {
    return { canUpload: false, reason: 'File upload not available for free/trial users' };
  }
  return { canUpload: true };
};

module.exports = mongoose.model('User', userSchema);