const express = require("express");
const { getKnowledgeStatus } = require("../controllers/knowledgeController");

const router = express.Router();

router.get("/status", getKnowledgeStatus);

module.exports = router;
