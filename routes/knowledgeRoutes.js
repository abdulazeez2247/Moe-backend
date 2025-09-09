const express = require('express');
const { getKnowledgeStatus } = require('../controllers/knowledgeController');

const router = express.Router();

// Combined endpoint: YouTube + Facebook videos with tagging
router.get('/status', getKnowledgeStatus);

module.exports = router;
