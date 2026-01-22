# Pillama - Hailo Platform Ollama API

Ollama-compatible REST API server that uses the `hailo-platform` Python module for LLM inference on Hailo hardware.

## Architecture

```
┌─────────────┐         WebSocket          ┌──────────────────┐
│   Express   │ ◄────────────────────────► │  Python Service  │
│   Server    │      (Port 8765)           │  (hailo-platform)│
└─────────────┘                            └──────────────────┘
      │                                              │
      │ REST API (Port 11434)                       │
      ▼                                              ▼
  Ollama Clients                              Hailo Hardware
```

The server consists of two main components:

1. **Express Server** - Exposes Ollama-compatible REST API endpoints
2. **Python Service** - WebSocket server that wraps the hailo-platform module

## Features

- ✅ Ollama API compatibility
- ✅ Streaming and non-streaming responses
- ✅ Chat completions (`/api/chat`)
- ✅ Text generation (`/api/generate`)
- ✅ Model management (`/api/tags`, `/api/show`)
- ✅ WebSocket communication for efficient streaming
- ✅ Automatic reconnection handling
- ✅ Graceful shutdown

## Prerequisites

- Node.js 16+ and npm
- Python 3.8+
- Hailo hardware and drivers
- `hailo-platform` Python module

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pillama
```

2. Install dependencies:
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

3. Configure models:
Edit `config.json` to add your HEF model files:
```json
{
  "hailo": {
    "models": {
      "llama3.2:latest": {
        "hef_path": "./models/llama3.2.hef",
        "family": "llama",
        "parameter_size": "3.2B",
        "format": "hef"
      }
    }
  }
}
```

4. Place your HEF model files in the `models/` directory.

## Usage

### Start the Services

You need to run both the Python service and Express server:

**Terminal 1 - Python Service:**
```bash
python python_service/hailo_service.py
```

**Terminal 2 - Express Server:**
```bash
npm start
```

Or use the development mode with auto-restart:
```bash
npm run dev
```

### Test the API

**Health check:**
```bash
curl http://localhost:11434/api/health
```

**List models:**
```bash
curl http://localhost:11434/api/tags
```

**Chat completion (streaming):**
```bash
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "stream": true
}'
```

**Text generation (non-streaming):**
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

## API Endpoints

### POST /api/chat
Generate a chat completion.

**Request:**
```json
{
  "model": "llama3.2",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true,
  "options": {
    "temperature": 0.8,
    "seed": 42,
    "num_predict": 100
  }
}
```

**Response (streaming):**
```json
{"model":"llama3.2","created_at":"2026-01-22T...","message":{"role":"assistant","content":"Hello"},"done":false}
{"model":"llama3.2","created_at":"2026-01-22T...","message":{"role":"assistant","content":"!"},"done":false}
{"model":"llama3.2","created_at":"2026-01-22T...","message":{"role":"assistant","content":""},"done":true,"total_duration":1234567890}
```

### POST /api/generate
Generate text completion from a prompt.

**Request:**
```json
{
  "model": "llama3.2",
  "prompt": "The capital of France is",
  "stream": false,
  "options": {
    "temperature": 0.5,
    "num_predict": 50
  }
}
```

**Response:**
```json
{
  "model": "llama3.2",
  "created_at": "2026-01-22T...",
  "response": "Paris, which is located in the northern part of the country...",
  "done": true,
  "total_duration": 1234567890,
  "eval_count": 42
}
```

### GET /api/tags
List available models.

**Response:**
```json
{
  "models": [
    {
      "name": "llama3.2:latest",
      "modified_at": "2026-01-22T...",
      "size": 2019393189,
      "digest": "a80c4f17acd55265...",
      "details": {
        "format": "hef",
        "family": "llama",
        "parameter_size": "3.2B"
      }
    }
  ]
}
```

### POST /api/show
Show model information.

**Request:**
```json
{
  "model": "llama3.2"
}
```

**Response:**
```json
{
  "modelfile": "# Hailo Model\nFROM ./models/llama3.2.hef",
  "parameters": "temperature 0.8\nnum_predict 2048",
  "details": {
    "format": "hef",
    "family": "llama",
    "parameter_size": "3.2B"
  }
}
```

### GET /api/ps
List running models.

**Response:**
```json
{
  "models": []
}
```

### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "python_service": "connected"
}
```

## Configuration

Edit `config.json` to customize the server:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 11434
  },
  "python_service": {
    "host": "127.0.0.1",
    "ws_port": 8765
  },
  "hailo": {
    "models_dir": "./models",
    "default_model": "llama3.2",
    "models": {
      "llama3.2:latest": {
        "hef_path": "./models/llama3.2.hef",
        "family": "llama",
        "parameter_size": "3.2B",
        "format": "hef"
      }
    }
  },
  "generation": {
    "default_temperature": 0.8,
    "default_max_tokens": 2048,
    "default_keep_alive": "5m"
  }
}
```

## Use with Ollama Clients

Since this server implements the Ollama API, you can use it with any Ollama-compatible client:

**Python (ollama library):**
```python
import ollama

# Configure to use your server
client = ollama.Client(host='http://localhost:11434')

response = client.chat(model='llama3.2', messages=[
  {'role': 'user', 'content': 'Hello!'}
])
print(response['message']['content'])
```

**JavaScript:**
```javascript
const response = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.2',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: false
  })
});

const data = await response.json();
console.log(data.message.content);
```

## Development

**Run in development mode with auto-reload:**
```bash
npm run dev
```

**Project structure:**
```
pillama/
├── config.json              # Configuration file
├── package.json             # Node.js dependencies
├── requirements.txt         # Python dependencies
├── python_service/
│   └── hailo_service.py    # Python WebSocket service
├── src/
│   ├── index.js            # Main Express server
│   ├── hailo-client.js     # WebSocket client
│   ├── utils.js            # Utility functions
│   └── routes/
│       └── ollama.js       # Ollama API routes
└── models/                 # HEF model files (not in repo)
```

## Troubleshooting

**Python service won't start:**
- Ensure hailo-platform is installed: `pip list | grep hailo`
- Check Hailo drivers are loaded: `lsmod | grep hailo`
- Verify hardware connection

**Express server can't connect:**
- Make sure Python service is running first
- Check WebSocket port (8765) is not in use
- Verify config.json settings match

**Model loading fails:**
- Check HEF file path in config.json
- Ensure HEF file exists and is readable
- Verify model is compatible with your Hailo hardware

**Mock mode responses:**
- If you see "This is a mock response", hailo-platform is not available
- Useful for testing API without hardware

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
