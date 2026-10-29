// src/server.js
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const limiter = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

app.use(cors());
app.use(express.json());
app.use(limiter);
app.use(
  morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } })
);

app.use('/api', routes);

// health check
app.get('/', (req, res) =>
  res.json({ message: 'Boutique Inventory API', status: 'ok' })
);

app.use(errorHandler);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  logger.info(`Server started on port ${port}`);
  console.log(`Server started on port ${port}`);
});
