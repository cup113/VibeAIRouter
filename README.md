# VibeAI Router - Free AI Model Proxy

A free AI model proxy service that forwards requests to free AI models without requiring user login. Compatible with OpenAI API format.

## Features

- 🆓 **Free Models**: Access to 8+ free AI models from SiliconFlow and Gitee AI
- 🔄 **OpenAI Compatible**: Full compatibility with OpenAI API format
- 🔐 **No Login Required**: Users don't need API keys
- ⚡ **Zero Cost**: Uses free model APIs
- 🐳 **Docker Ready**: Easy deployment with Docker Compose
- 📊 **Health Monitoring**: Built-in health check endpoints
- 🔧 **Hot Reload**: Configuration updates without restart

## Supported Models

### SiliconFlow API
- `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B`
- `Qwen/Qwen3-8B`
- `THUDM/GLM-4.1V-9B-Thinking`
- `internlm/internlm2_5-7b-chat`

### Gitee AI API
- `Lingshu-32B`
- `DeepSeek-R1-Distill-Qwen-14B`
- `GLM-4.6V-Flash`
- `Security-semantic-filtering`

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd vibeai-router
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Docker Deployment
```bash
npm run docker:build
npm run docker:up
```

## API Usage

### Chat Completion
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3-8B",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Health Check
```bash
curl http://localhost:3000/health
```

## Configuration

### Environment Variables
See `.env.example` for all available options.

### Model Configuration
Edit `config/default.json` to modify model mappings, timeouts, and other settings.

## Architecture

- **Express.js**: Web server framework
- **Provider Abstraction**: Unified interface for different AI APIs
- **Rate Limiting**: IP-based and global rate limiting
- **Request Queue**: Prevents overload
- **Hot Reload**: Configuration updates without restart

## Security

- CORS enabled for all origins
- IP-based rate limiting (30 req/min per IP)
- Global rate limiting (100 req/min)
- Request timeout protection
- Input validation and sanitization

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## Docker

```bash
# Build image
docker build -t vibeai-router .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## License

MIT