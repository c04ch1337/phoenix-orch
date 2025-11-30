const http = require('http');
const fs = require('fs');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/sse/subconscious',
  method: 'GET',
  headers: {
    'Accept': 'text/event-stream'
  }
};

console.log('Connecting to SSE endpoint...');
const outputFile = fs.createWriteStream('subconscious_events.txt');
outputFile.write('=== Subconscious Events Capture ===\n\n');

const startTime = Date.now();
let eventCount = 0;
const loopsDetected = new Set();

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

  res.on('data', (chunk) => {
    const data = chunk.toString();
    
    // Check if this is a real SSE data chunk
    if (data.startsWith('data: ')) {
      try {
        const eventData = JSON.parse(data.replace('data: ', ''));
        eventCount++;
        
        // Track unique loops
        if (eventData.active_loop) {
          loopsDetected.add(eventData.active_loop);
        }
        
        // Format and write to file
        outputFile.write(`Event #${eventCount} (${(Date.now() - startTime)/1000}s):\n`);
        outputFile.write(`Loop: ${eventData.active_loop}\n`);
        outputFile.write(`Timestamp: ${eventData.timestamp}\n`);
        outputFile.write(`Thought: ${eventData.last_thought}\n`);
        outputFile.write(`---\n\n`);
        
        console.log(`Received event #${eventCount} from loop: ${eventData.active_loop}`);
        
        // Exit after 5 events or 60 seconds
        if (eventCount >= 5 || (Date.now() - startTime) >= 60000) {
          console.log('\nCapture complete!');
          console.log(`Captured ${eventCount} events`);
          console.log(`Detected ${loopsDetected.size} unique loops: ${Array.from(loopsDetected).join(', ')}`);
          console.log(`Events written to subconscious_events.txt`);
          
          // Write summary
          outputFile.write('=== SUMMARY ===\n');
          outputFile.write(`Total events captured: ${eventCount}\n`);
          outputFile.write(`Unique loops detected: ${loopsDetected.size}\n`);
          outputFile.write(`Loops: ${Array.from(loopsDetected).join(', ')}\n`);
          outputFile.write(`Capture duration: ${(Date.now() - startTime)/1000} seconds\n`);
          
          outputFile.end();
          process.exit(0);
        }
      } catch (e) {
        console.error('Error processing event:', e);
        console.error('Raw data:', data);
      }
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  process.exit(1);
});

// Set timeout for the entire capture (60 seconds)
setTimeout(() => {
  console.log('\nTimeout reached (60 seconds)');
  console.log(`Captured ${eventCount} events from ${loopsDetected.size} unique loops`);
  
  // Write summary
  outputFile.write('=== SUMMARY ===\n');
  outputFile.write(`Total events captured: ${eventCount}\n`);
  outputFile.write(`Unique loops detected: ${loopsDetected.size}\n`);
  outputFile.write(`Loops: ${Array.from(loopsDetected).join(', ')}\n`);
  outputFile.write(`Capture duration: 60 seconds (timeout)\n`);
  
  outputFile.end();
  process.exit(0);
}, 60000);

req.end();
console.log('Waiting for events (max 60 seconds)...');