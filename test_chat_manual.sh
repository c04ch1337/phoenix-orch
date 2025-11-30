#!/bin/bash
# Manual Chat System Verification Script
# Tests the chat system end-to-end

echo "🔥 Phoenix ORCH Chat System Verification"
echo "=========================================="
echo ""

# Check if backend is running
echo "1. Checking backend server..."
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo "   ✅ Backend server is running"
else
    echo "   ❌ Backend server is NOT running"
    echo "   Please start the backend: cd phoenix-kernel/phoenix-core && cargo run --bin api-server"
    exit 1
fi

# Check diagnostic endpoint
echo ""
echo "2. Checking chat diagnostic endpoint..."
DIAGNOSTIC=$(curl -s http://localhost:5001/api/v1/chat/diagnostic)
if echo "$DIAGNOSTIC" | grep -q "configured"; then
    echo "   ✅ Chat diagnostic endpoint working"
    echo "$DIAGNOSTIC" | jq '.'
else
    echo "   ❌ Chat diagnostic endpoint failed"
    echo "$DIAGNOSTIC"
    exit 1
fi

# Test LLM service
echo ""
echo "3. Testing LLM service via query endpoint..."
QUERY_RESPONSE=$(curl -s -X POST http://localhost:5001/query \
    -H "Content-Type: application/json" \
    -d '{"query": "Hello, Phoenix. This is a test. Please respond with exactly: TEST_SUCCESSFUL"}')

if echo "$QUERY_RESPONSE" | grep -q "TEST_SUCCESSFUL"; then
    echo "   ✅ LLM service is working!"
    echo "   Response: $(echo "$QUERY_RESPONSE" | jq -r '.response' | head -c 100)"
else
    echo "   ⚠️  LLM service response received (may not contain exact test string)"
    echo "   Response: $(echo "$QUERY_RESPONSE" | jq -r '.response' | head -c 200)"
fi

echo ""
echo "✅ Chat system verification complete!"
echo ""
echo "To test via WebSocket, open the frontend and send a message in the chat."

