# opencode-provider-router

OpenCode plugin for cost-aware AI provider routing. Automatically picks the best model based on task type, complexity, and provider availability with fallback chains.

## Features

- **Smart routing** — chooses optimal model by task type (coding, vision, research, browser, chat)
- **Fallback chains** — tries preferred → fallback1 → fallback2 automatically across multiple providers (Google, Groq, Mistral, Copilot, OpenRouter, Ollama)
- **Cost-aware** — uses cheap/free models (Google AI Studio, Groq, Ollama) for simple tasks, powerful models (Copilot, OpenRouter, Mistral Large) for complex work
- **Live health checks** — queries provider availability in real-time
- **Quota monitoring** — checks remaining Copilot and provider quotas before routing

## Installation

```bash
# Via npm (once published)
npm install -g opencode-provider-router

# Or from source
git clone https://github.com/ziuus/opencode-provider-router.git
cd opencode-provider-router
npm install && npm run build
```

Then add to `~/.config/opencode/opencode.json`:
```json
"plugin": [
  "...",
  "opencode-provider-router"
]
```

## Usage

In any OpenCode session, call these tools:

### Route a task

```
Route a complex coding task to the best available model.
```

### Check all providers

```
What providers are available right now?
```

### Check quota

```
How much Copilot quota do I have left?
```

## Routing Table

| Task Type | Simple | Medium/Complex |
|-----------|--------|----------------|
| Coding | Google → Groq → Mistral → Copilot → OpenRouter → Ollama | Copilot → Mistral → Groq → OpenRouter → Google → Ollama |
| Vision | Google → OpenRouter → Copilot → Mistral | — |
| Research | Google → Groq → Mistral → OpenRouter → Ollama | Google → Mistral → Groq → OpenRouter → Copilot |
| Browser | OpenRouter → Google → Groq | — |
| Chat | Google → Groq → Mistral → OpenRouter → Ollama | — |

## Supported Providers & Models

- **Google AI Studio**: `gemini-3.1-pro-preview`, `gemini-3-pro-preview`
- **Groq**: `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b`
- **Mistral**: `codestral-latest`, `mistral-large-latest`
- **GitHub Copilot**: `gpt-5.3-codex`
- **OpenRouter**: `anthropic/claude-opus-4.6`
- **Ollama**: Local models / local fallback


## Requirements

- Node.js >= 20
- OpenCode >= 1.2.0

## License

MIT
