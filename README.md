# opencode-provider-router

OpenCode plugin for cost-aware AI provider routing. Automatically picks the best model based on task type, complexity, and provider availability with fallback chains.

## Features

- **Smart routing** — chooses optimal model by task type (coding, vision, research, browser, chat)
- **Fallback chains** — tries preferred → fallback1 → fallback2 automatically
- **Cost-aware** — uses cheap/free models (Ollama, Antigravity) for simple tasks, powerful models (Copilot, OpenRouter) for complex work
- **Live health checks** — queries provider availability in real-time
- **Quota monitoring** — checks remaining Copilot credits before routing

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
| Coding | Ollama → Antigravity → Copilot | Copilot → OpenRouter → Antigravity |
| Vision | Antigravity → OpenRouter → Copilot | — |
| Research | Antigravity → Ollama | Antigravity → OpenRouter → Copilot |
| Browser | OpenRouter → Antigravity | — |
| Chat | Ollama → Antigravity | — |

## Requirements

- Node.js >= 20
- OpenCode >= 1.2.0

## License

MIT
