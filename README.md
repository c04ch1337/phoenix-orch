# Phoenix ORCH - Digital Twin Agentic AI Backend

A digital twin AI system with real-time chat, system telemetry, and protective capabilities.

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure OpenRouter API:
   - Sign up for an account at [OpenRouter](https://openrouter.ai)
   - Get your API key from the dashboard
   - Copy `.env.example` to `.env`
   - Add your OpenRouter API key to `.env`:
   ```
   OPENROUTER_API_KEY=your_api_key_here
   ```
   - Optionally configure the default model in `.env`:
   ```
   DEFAULT_MODEL=anthropic/claude-3-sonnet
   ```

3. Start the server:
```bash
cd frontend
node mock-server.cjs
```

## Features

- Real-time chat with AI via WebSocket
- System telemetry streaming via SSE
- Protection and security protocols
- Memory and conversation history
- Health and readiness monitoring

## API Endpoints

- WebSocket: `ws://localhost:5001/ws/dad`
- Telemetry: `http://localhost:5001/api/v1/telemetry-stream`
- Chat: `POST http://localhost:5001/api/v1/chat`
- Protect: `POST http://localhost:5001/api/v1/protect`
- Kill: `POST http://localhost:5001/api/v1/kill`
- Memory: `GET http://localhost:5001/api/v1/memory`
- Health: `GET http://localhost:5001/health`
- Ready: `GET http://localhost:5001/ready`

## Error Handling

If the OpenRouter API key is not configured:
- The server will fall back to pre-programmed responses
- A warning will be displayed in the console
- Health and ready endpoints will indicate AI backend is disabled
- Chat endpoints will use fallback responses

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| OPENROUTER_API_KEY | Your OpenRouter API key | Required |
| DEFAULT_MODEL | Model to use for chat | anthropic/claude-3-sonnet |