const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const getReadiness = (req, res, next) => {
  req.rateLimitTier = 'unauthenticated';
  if (req.user) {
    req.rateLimitTier = req.user.plan;
  }
  next();
};

const freeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: async (req, res) => {
    return 50;
  },
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.rateLimitTier !== 'free'
});

const paidLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: async (req, res) => {
    return 500;
  },
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.rateLimitTier === 'free' || req.rateLimitTier === 'unauthenticated'
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    status: 'fail',
    message: 'Too many authentication attempts from this IP, please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.rateLimitTier !== 'unauthenticated'
});

module.exports = {
  getReadiness,
  freeLimiter,
  paidLimiter,
  authLimiter
};