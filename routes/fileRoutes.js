const express = require("express");
const { uploadFile, getFileHistory } = require("../controllers/fileController");
const { protect } = require("../middlewares/authMiddleware");
const { upload } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/upload", protect, upload.single("file"), uploadFile);
router.get("/history", protect, getFileHistory);

module.exports = router;
