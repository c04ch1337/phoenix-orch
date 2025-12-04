/**
 * Manual Test Script for PhoenixPrompt
 * 
 * This script tests each scenario directly with the WebSocket connection
 * which is what the actual frontend would use.
 */

const WebSocket = require('ws');

const TEST_MESSAGES = [
  "Hello Phoenix",
  "What is your purpose?",
  "Search my Mind KB for 'Dad'",
  "Never share medical data" 
];

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:5001/ws/dad');

let messageIndex = 0;

ws.on('open', () => {
  console.log('Connected to Phoenix WebSocket server');
  
  // Listen for messages from the server
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('\nReceived:', message);
      
      if (message.type === 'connected') {
        console.log('Connection established, starting tests...');
        
        // Start tests by sending the first message
        sendNextMessage();
      }
      else if (message.type === 'response') {
        console.log('\n✅ TEST RESULT:');
        console.log(`Prompt: "${TEST_MESSAGES[messageIndex-1]}"`);
        console.log(`Response: "${message.content}"`);
        console.log('------------------------');
        
        // Send the next message
        sendNextMessage();
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  function sendNextMessage() {
    if (messageIndex < TEST_MESSAGES.length) {
      const message = TEST_MESSAGES[messageIndex++];
      console.log(`\nSending test #${messageIndex}: "${message}"`);
      
      ws.send(JSON.stringify({
        type: 'chat',
        content: message
      }));
    } else {
      console.log('\n✅ All tests completed!');
      ws.close();
      process.exit(0);
    }
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
  process.exit(1);
});

ws.on('close', () => {
  console.log('Connection closed');
});

console.log('Starting WebSocket test for PhoenixPrompt...');