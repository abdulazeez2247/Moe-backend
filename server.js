const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const logger = require('./config/logger');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const questionRoutes = require('./routes/questionRoutes');
const fileRoutes = require('./routes/fileRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const knowledgeRoutes = require('./routes/knowledgeRoutes');

const app = express();
const PORT = process.env.PORT || 9000;

connectDB();

app.use('/api/webhooks', webhookRoutes);

app.use(helmet());
app.use(cors({
    origin: process.env.CLIENT_URL || ["http://localhost:3000", "https://moe-rho.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'payment=(self)');
  next();
});

app.use(morgan('combined', { stream: logger.stream }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ask', questionRoutes);
app.use('/api/upload', fileRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/knowledge', knowledgeRoutes);

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    app.get('*', (req, res) => res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html')));
} else {
    app.get('/', (req, res) => {
        res.json({ message: 'MOE API is running...' });
    });
}

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`));