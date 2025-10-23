const express = require("express");
const {
  askQuestion,
  voteAnswer,
  getCatalog,
} = require("../controllers/questionController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", protect, askQuestion); 
router.post("/:answerId/vote", protect, voteAnswer);
router.get("/catalog", getCatalog);

module.exports = router;
