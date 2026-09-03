const express = require('express');
const cors = require('cors');
const path = require('path');
const VoltageAIEngine = require('./engine/model');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets if applicable
app.use(express.static(path.join(__dirname, '../public')));

const engine = new VoltageAIEngine();

// Initialize ONNX AI Engine on server startup
engine.initialize()
  .then(() => {
    console.log('[Server] Voltage AI Engine initialized successfully.');
  })
  .catch((err) => {
    console.error('[Server] Failed to initialize AI engine:', err);
  });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', model: 'Voltage-V1' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await engine.generate(prompt);
    res.json({ response });
  } catch (error) {
    console.error('[API Error]:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

app.listen(PORT, () => {
  console.log(`[Server] Voltage AI running on port ${PORT}`);
});
