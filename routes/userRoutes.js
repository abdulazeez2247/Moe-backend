const express = require("express");
const { getUserProfile, updateUserProfile, getUsage } = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/profile", protect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);
router.get("/usage", protect, getUsage);

module.exports = router;
