const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./utils/config');
const healthRoutes = require('./routes/health');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static frontend assets (prepared for Bit 13)
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', healthRoutes);

// Catch-all route for undefined API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.originalUrl} does not exist.`
  });
});

// Start Server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`[Voltage] Server running in ${config.env} mode on port ${PORT}`);
  console.log(`[Voltage] Health check available at http://localhost:${PORT}/api/health`);
});
