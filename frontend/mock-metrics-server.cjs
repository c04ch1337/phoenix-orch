const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const server = app.listen(5001, () => {
  console.log('Mock metrics server running on port 5001');
});

const wss = new WebSocket.Server({ server });

// Initial metrics state
let metrics = {
  daysUntilExplosion: 1826,
  orchestratedNodes: 52,
  ashenGuardCells: 11,
  currentPhase: 'Act I – Narrow AI → AGI',
  conscienceTemperature: 97.8,
  lastUpdated: new Date().toISOString()
};

// Simulate random metric changes
function updateMetrics() {
  metrics = {
    daysUntilExplosion: Math.max(0, metrics.daysUntilExplosion - Math.random()),
    orchestratedNodes: metrics.orchestratedNodes + (Math.random() > 0.7 ? 1 : 0),
    ashenGuardCells: metrics.ashenGuardCells + (Math.random() > 0.9 ? 1 : 0),
    currentPhase: metrics.currentPhase,
    conscienceTemperature: Math.min(100, metrics.conscienceTemperature + (Math.random() * 0.2 - 0.1)),
    lastUpdated: new Date().toISOString()
  };
  return metrics;
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  
  // Send initial metrics
  ws.send(JSON.stringify({ type: 'metrics', payload: metrics }));
  
  // Update and send metrics every 2 seconds
  const interval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const updatedMetrics = updateMetrics();
      ws.send(JSON.stringify({ type: 'metrics', payload: updatedMetrics }));
    }
  }, 2000);
  
  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    clearInterval(interval);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// REST API endpoint for polling fallback
app.get('/api/v1/metrics', (req, res) => {
  res.json(updateMetrics());
});

console.log('WebSocket endpoint: ws://localhost:5001');
console.log('REST API endpoint: http://localhost:5001/api/v1/metrics');