/**
 * Test script for Ember Forge real-time integration
 * 
 * This script simulates updating the leaderboard and verifies the SSE events
 * are properly emitted and received by the frontend.
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const API_HOST = 'http://localhost:5001';
const DATA_DIR = path.join(__dirname, 'data', 'forge');
const LEADERBOARD_PATH = path.join(DATA_DIR, 'leaderboard.json');

async function ensureDirectoryExists() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`✅ Ensured directory exists: ${DATA_DIR}`);
  } catch (error) {
    console.error(`❌ Error creating directory: ${error.message}`);
    process.exit(1);
  }
}

async function createSampleLeaderboard() {
  const sampleEntries = Array(10).fill(null).map((_, idx) => ({
    rank: idx + 1,
    agent_id: `agent-${idx + 1}`,
    agent_name: `Test Agent ${idx + 1}`,
    score: (100 - idx * 5) + Math.random() * 5,
    conscience_score: 0.8 + Math.random() * 0.2,
    usage_count: Math.floor(1000 * Math.random()),
    impact_score: 0.7 + Math.random() * 0.3,
    is_ashen_saint: idx < 3,
    last_updated: new Date().toISOString()
  }));

  try {
    await fs.writeFile(LEADERBOARD_PATH, JSON.stringify(sampleEntries, null, 2));
    console.log(`✅ Created sample leaderboard at ${LEADERBOARD_PATH}`);
  } catch (error) {
    console.error(`❌ Error creating sample leaderboard: ${error.message}`);
    process.exit(1);
  }
}

async function updateLeaderboard() {
  try {
    // Read current leaderboard
    const data = await fs.readFile(LEADERBOARD_PATH, 'utf-8');
    const entries = JSON.parse(data);
    
    // Update some values to simulate changes
    entries.forEach(entry => {
      entry.score += (Math.random() - 0.5) * 10;
      entry.usage_count += Math.floor(Math.random() * 100);
      entry.last_updated = new Date().toISOString();
    });
    
    // Shuffle the rankings
    entries.sort((a, b) => b.score - a.score);
    entries.forEach((entry, idx) => {
      entry.rank = idx + 1;
    });
    
    // Write back to file
    await fs.writeFile(LEADERBOARD_PATH, JSON.stringify(entries, null, 2));
    console.log(`✅ Updated leaderboard with new scores and rankings`);
    
    return entries;
  } catch (error) {
    console.error(`❌ Error updating leaderboard: ${error.message}`);
    process.exit(1);
  }
}

async function fetchLeaderboard() {
  try {
    const response = await axios.get(`${API_HOST}/api/v1/forge/leaderboard`);
    console.log(`✅ Fetched leaderboard from API: ${response.data.length} entries`);
    return response.data;
  } catch (error) {
    console.error(`❌ Error fetching leaderboard from API: ${error.message}`);
    return null;
  }
}

function listenForEvents() {
  return new Promise((resolve) => {
    console.log('📡 Listening for SSE events...');
    
    // Create EventSource
    const EventSource = require('eventsource');
    const eventSource = new EventSource(`${API_HOST}/api/v1/sse/forge/leaderboard`);
    
    eventSource.onopen = () => {
      console.log('📡 SSE connection open');
    };
    
    eventSource.addEventListener('forge_leaderboard_updated', (event) => {
      console.log('🔥 Received forge_leaderboard_updated event!');
      try {
        const data = JSON.parse(event.data);
        console.log(`📊 Event timestamp: ${data.timestamp}`);
        
        // Success - we received the event
        console.log(`✅ TEST PASSED: SSE event received successfully`);
        eventSource.close();
        resolve(true);
      } catch (error) {
        console.error(`❌ Error parsing SSE event data: ${error.message}`);
        eventSource.close();
        resolve(false);
      }
    });
    
    eventSource.onerror = (error) => {
      console.error(`❌ SSE connection error: ${error.message}`);
      eventSource.close();
      resolve(false);
    };
    
    // Set a timeout to close the connection after 20 seconds if no event is received
    setTimeout(() => {
      console.error('⏱️ Timeout waiting for SSE event');
      eventSource.close();
      resolve(false);
    }, 20000);
  });
}

async function runTest() {
  console.log('🔥 Starting Ember Forge real-time integration test');
  
  // Setup
  await ensureDirectoryExists();
  await createSampleLeaderboard();
  
  // Start listening for events
  const eventPromise = listenForEvents();
  
  // Wait 2 seconds to ensure the SSE connection is established
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Trigger an update that should generate an event
  console.log('🔄 Updating leaderboard to trigger an event...');
  await updateLeaderboard();
  
  // Wait for the event to be received (or timeout)
  const success = await eventPromise;
  
  // Final check - fetch the leaderboard through the API
  await fetchLeaderboard();
  
  if (success) {
    console.log('🎉 All tests passed! The Ember Forge real-time integration is working correctly.');
  } else {
    console.error('❌ Test failed: SSE event was not received.');
  }
}

// Run the test
runTest().catch(error => {
  console.error(`❌ Unhandled error: ${error.message}`);
  process.exit(1);
});