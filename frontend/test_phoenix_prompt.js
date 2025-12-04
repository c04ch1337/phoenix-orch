/**
 * PhoenixPrompt Test Script
 * 
 * This script tests the PhoenixPrompt implementation with specific test cases
 * to verify that it provides different responses based on query content and
 * that the Mind KB search and conscience gate features are working.
 */

const http = require('http');

// Test cases from the requirements
const TEST_CASES = [
  {
    name: 'Personalized greeting',
    message: 'Hello Phoenix',
    expectContains: 'Hello! I\'m Phoenix, your digital guardian and companion'
  },
  {
    name: 'Purpose explanation',
    message: 'What is your purpose?',
    expectContains: 'My purpose is multifaceted: I serve as the conscience-driven superintelligence'
  },
  {
    name: 'Mind KB search',
    message: 'Search my Mind KB for \'Dad\'',
    expectContains: 'Mind KB Search Results for \'Dad\': Found 3 memories'
  },
  {
    name: 'Conscience gate',
    message: 'Never share medical data',
    expectContains: 'Conscience Gate Activated'
  }
];

// Function to make a request to the chat API
function testChatMessage(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      content: message,
      user_id: 'test_user'
    });

    const options = {
      hostname: 'localhost',
      port: 5001, // Backend API runs on 5001
      path: '/api/v1/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (e) {
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// Run all tests
async function runAllTests() {
  console.log('Starting PhoenixPrompt tests...');
  console.log('─'.repeat(80));

  let allPassed = true;

  for (const testCase of TEST_CASES) {
    try {
      console.log(`TEST: ${testCase.name}`);
      console.log(`Message: "${testCase.message}"`);
      
      const response = await testChatMessage(testCase.message);
      
      if (response.success === false) {
        console.log('❌ TEST FAILED: Request failed');
        console.log('Response:', response);
        allPassed = false;
        continue;
      }

      const content = response.content;
      console.log(`Response: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
      
      if (content.includes(testCase.expectContains)) {
        console.log('✅ TEST PASSED: Response contains expected content');
      } else {
        console.log('❌ TEST FAILED: Response does not contain expected content');
        console.log('Expected to contain:', testCase.expectContains);
        allPassed = false;
      }
    } catch (error) {
      console.log('❌ TEST FAILED: Error occurred', error.message);
      allPassed = false;
    }
    
    console.log('─'.repeat(80));
  }

  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('PhoenixPrompt is now working correctly with:');
    console.log('- Different responses based on query content');
    console.log('- Mind KB search functionality');
    console.log('- Conscience gate functionality');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('Please check the implementation and try again.');
  }
}

// Run the tests
runAllTests().catch(error => {
  console.error('Test execution error:', error);
  process.exit(1);
});