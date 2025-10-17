const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
// const sendEmail = require('../utils/sendEmail')
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

const signRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

const createSendToken = async (user, statusCode, req, res) => {
  const accessToken = signToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  res.cookie("refreshToken", refreshToken, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  });

  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    accessToken,
    refreshToken,
    data: { user },
  });
};

const signup = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log("Signup body:", req.body);
    const newUser = await User.create({ email, password });
    createSendToken(newUser, 201, req, res);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res
        .status(401)
        .json({ status: "fail", message: "Incorrect email or password" });
    }
    createSendToken(user, 200, req, res);
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};

    if (!refreshToken) {
      return res
        .status(401)
        .json({ status: "fail", message: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ status: "fail", message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(401)
        .json({ status: "fail", message: "User not found" });
    }

    const accessToken = signToken(user._id);
    res.status(200).json({ status: "success", accessToken });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(200)
        .json({ status: "success", message: "Password reset email sent" });

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/auth/reset-password/${resetToken}`;

    const message = `You requested a password reset. Click the link below to reset your password:\n\n${resetURL}\n\nIf you didn't request this, please ignore this email.`;
    await sendEmail({
      email: user.email,
      subject: "Password Reset Request",
      message,
    });

    console.log(`Password reset token for ${email}: ${resetURL}`);

    res
      .status(200)
      .json({ status: "success", message: "Password reset email sent" });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password)
      return res
        .status(400)
        .json({ status: "fail", message: "Password is required" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user)
      return res
        .status(400)
        .json({ status: "fail", message: "Token is invalid or has expired" });

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    createSendToken(user, 200, req, res);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
  getMe,
};
