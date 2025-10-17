const aws = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { v4: uuidv4 } = require("uuid");

const s3 = new aws.S3({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const allowedExtensions = [".cab", ".cabx", ".mzb", ".xml", ".zip"];

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const ext = file.originalname.substring(
        file.originalname.lastIndexOf(".")
      );
      const filename = `uploads/${uuidv4()}${ext}`;
      cb(null, filename);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  fileFilter: (req, file, cb) => {
    const ext = file.originalname
      .substring(file.originalname.lastIndexOf("."))
      .toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`), false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB) * 1024 * 1024,
  },
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        status: "fail",
        message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB}MB.`,
      });
    }
  }
  if (err) {
    return res.status(400).json({
      status: "fail",
      message: err.message,
    });
  }
  next();
};

module.exports = {
  upload,
  handleMulterError,
};
