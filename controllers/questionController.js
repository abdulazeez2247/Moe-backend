const Question = require('../models/Question');
const { generateAnswer } = require('../utils/gptHelper');
const logger = require('../config/logger');

const askQuestion = async (req, res, next) => {
    try {
        const { message, platform = 'generic', version = null } = req.body;
        
        // Validate input
        if (!message || message.trim() === '') {
            return res.status(400).json({
                status: 'fail',
                message: 'Question message is required'
            });
        }
        
        const canAsk = req.user.canAskQuestion();
        if (!canAsk.canAsk) {
            return res.status(403).json({
                status: 'fail',
                message: canAsk.reason,
                upgradeRequired: true
            });
        }
        
        req.user.incrementUsage();
        
        req.user.assistantMessageCount += 1;
        const isFreeUser = req.user.plan === 'free' || req.user.plan === 'trial';
        const showAd = isFreeUser && (req.user.assistantMessageCount % 2 === 0);
        
        await req.user.save();

        // Check for cached answer
        const cachedAnswer = await Question.findByQuestion(message, platform, version);
        if (cachedAnswer) {
            cachedAnswer.popularity += 1;
            await cachedAnswer.save();
            return res.status(200).json({
                status: 'success',
                data: {
                    answer: cachedAnswer.answer,
                    modelUsed: 'cache',
                    answerId: cachedAnswer._id,
                    sources: cachedAnswer.sources,
                    isCacheHit: true,
                    showAd: showAd
                }
            });
        }

        // Generate new answer
        const model = isFreeUser ? process.env.FREE_MODEL : process.env.PAID_MODEL;
        
        // Validate model configuration
        if (!model) {
            logger.error('Model configuration missing');
            return res.status(500).json({
                status: 'fail',
                message: 'Server configuration error. Please try again later.'
            });
        }

        const { text, tokens, sources } = await generateAnswer(message, platform, version, model);

        // Validate AI response
        if (!text || text.trim() === '') {
            logger.error('Empty response from AI model', { message, platform, version, model });
            return res.status(500).json({
                status: 'fail',
                message: 'The AI model returned an empty response. Please try again with a different question.'
            });
        }

        const newQuestion = await Question.createFromQuestion(
            message, platform, version, text, model, tokens, sources
        );

        res.status(200).json({
            status: 'success',
            data: {
                answer: newQuestion.answer,
                modelUsed: newQuestion.modelUsed,
                answerId: newQuestion._id,
                sources: newQuestion.sources,
                isCacheHit: false,
                showAd: showAd,
                tokens: tokens // Include token information
            }
        });

    } catch (error) {
        logger.error('Error in askQuestion controller:', error);
        
        // Handle specific error types
        if (error.message.includes('OpenAI API') || error.message.includes('AI model')) {
            return res.status(502).json({
                status: 'fail',
                message: 'AI service is temporarily unavailable. Please try again shortly.'
            });
        }
        
        if (error.message.includes('rate limit') || error.message.includes('quota')) {
            return res.status(429).json({
                status: 'fail',
                message: 'AI service rate limit exceeded. Please try again in a few moments.'
            });
        }
        
        // Generic error response
        res.status(500).json({
            status: 'fail',
            message: 'An unexpected error occurred while processing your question. Please try again.'
        });
    }
};

const voteAnswer = async (req, res, next) => {
    try {
        const { answerId } = req.params;
        const { vote } = req.body;
        
        // Validate input
        if (!answerId) {
            return res.status(400).json({ 
                status: 'fail', 
                message: 'Answer ID is required' 
            });
        }
        
        if (!['up', 'down'].includes(vote)) {
            return res.status(400).json({ 
                status: 'fail', 
                message: 'Vote must be "up" or "down"' 
            });
        }

        const question = await Question.findById(answerId);
        if (!question) {
            return res.status(404).json({ 
                status: 'fail', 
                message: 'Answer not found' 
            });
        }

        if (vote === 'up') question.ups += 1;
        if (vote === 'down') question.downs += 1;
        
        await question.save();

        res.status(200).json({ 
            status: 'success', 
            data: { question } 
        });
    } catch (error) {
        logger.error('Error in voteAnswer controller:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                status: 'fail',
                message: 'Invalid answer ID format'
            });
        }
        
        res.status(500).json({
            status: 'fail',
            message: 'Failed to process vote. Please try again.'
        });
    }
};

const getCatalog = async (req, res, next) => {
    try {
        const { platform, page = 1, limit = 10 } = req.query;
        const query = { published: true };
        
        if (platform && platform !== 'all') {
            query.platform = platform;
        }

        // Validate pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                status: 'fail',
                message: 'Invalid page number'
            });
        }
        
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                status: 'fail',
                message: 'Limit must be between 1 and 100'
            });
        }

        const questions = await Question.find(query)
            .sort({ popularity: -1, createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum);

        const total = await Question.countDocuments(query);

        res.status(200).json({
            status: 'success',
            results: questions.length,
            data: { questions },
            totalPages: Math.ceil(total / limitNum),
            currentPage: pageNum,
            total
        });
    } catch (error) {
        logger.error('Error in getCatalog controller:', error);
        
        res.status(500).json({
            status: 'fail',
            message: 'Failed to retrieve questions catalog. Please try again.'
        });
    }
};

module.exports = {
    askQuestion,
    voteAnswer,
    getCatalog
};