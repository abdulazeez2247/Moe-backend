const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in. Please log in to get access.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "The user belonging to this token no longer exists.",
      });
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: "fail",
        message: "User recently changed password. Please log in again.",
      });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({
          status: "fail",
          message: "Invalid token. Please log in again.",
        });
    }
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({
          status: "fail",
          message: "Your token has expired. Please log in again.",
        });
    }
    next(error);
  }
};

const restrictTo = (...plans) => {
  return (req, res, next) => {
    if (!plans.includes(req.user.plan)) {
      return res.status(403).json({
        status: "fail",
        message:
          "Your subscription plan does not have permission to perform this action.",
      });
    }
    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);
      if (currentUser && !currentUser.changedPasswordAfter(decoded.iat)) {
        req.user = currentUser;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  protect,
  restrictTo,
  optionalAuth,
};
