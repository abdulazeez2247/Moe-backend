const File = require('../models/File');

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: 'fail', message: 'No file uploaded' });
        }

        if (req.user.plan === 'free' || req.user.plan === 'trial') {
            return res.status(402).json({
                status: 'fail',
                message: 'File upload requires a paid plan upgrade',
                upgradeRequired: true
            });
        }

        const newFile = await File.create({
            user: req.user.id,
            originalName: req.file.originalname,
            storedName: req.file.key,
            mimeType: req.file.mimetype,
            size: req.file.size,
            program: 'mozaik',
            status: 'uploaded'
        });

        await fetch(process.env.FILE_PROCESSOR_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: newFile._id, s3Key: req.file.key })
        });

        res.status(201).json({
            status: 'success',
            data: { file: newFile },
            message: 'File uploaded successfully. Processing started.'
        });

    } catch (error) {
        next(error);
    }
};

const getFileHistory = async (req, res, next) => {
    try {
        const files = await File.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', results: files.length, data: { files } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadFile,
    getFileHistory
};