const logger = require("../config/logger");

const handleJWTError = () => new Error("Invalid token. Please log in again.");
const handleJWTExpiredError = () =>
  new Error("Your token has expired. Please log in again.");
const handleCastErrorDB = (err) =>
  new Error(`Invalid ${err.path}: ${err.value}.`);
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg?.match(/(["'])(\\?.)*?\1/)?.[0] || "";
  return new Error(
    `Duplicate field value: ${value}. Please use another value.`
  );
};
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors || {}).map((el) => el.message);
  return new Error(`Invalid input data. ${errors.join(". ")}`);
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    status: err.status || "error",
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: err.status || "error",
      message: err.message,
    });
  } else {
    logger.error("ERROR ", err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message };

    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === "ValidationError")
      error = handleValidationErrorDB(error);
    if (error.name === "JsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

const notFound = (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server.`);
  err.statusCode = 404;
  err.status = "fail";
  next(err);
};

module.exports = { errorHandler, notFound };
