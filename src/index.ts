import { tool, type PluginInput, type Hooks } from "@opencode-ai/plugin";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";

const execAsync = promisify(exec);
const PROVIDER_STATUS_SCRIPT = join(homedir(), "bin", "provider-status");

async function runProviderStatus(force: boolean = false): Promise<string> {
  const flag = force ? "--json" : "--json";
  try {
    const { stdout } = await execAsync(`${PROVIDER_STATUS_SCRIPT} ${flag}`, {
      timeout: 30_000,
    });
    return stdout;
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Unknown error" }, null, 2);
  }
}

const plugin = async (_input: PluginInput): Promise<Hooks> => ({
  tool: {
    route_task: tool({
      description:
        "Find the best available model/agent for a task type. Uses cost-aware routing with fallback chains. Returns JSON with agent name, model ID, and reasoning.",
      args: {
        task_type: tool.schema.enum(["coding", "vision", "research", "browser", "chat"]),
        complexity: tool.schema.enum(["simple", "medium", "complex", "any"]).optional().default("simple"),
      },
      execute: async (args) => {
        // Parse provider status to make routing decisions
        const statusRaw = await runProviderStatus();
        let status: Record<string, any> = {};
        try {
          status = JSON.parse(statusRaw);
        } catch {
          return JSON.stringify({ error: "Failed to parse provider status" });
        }

        // Map model IDs to their provider key in the status dict
        const PROVIDER_MODEL_MAP: Record<string, string> = {
          "github-copilot/gpt-5.3-codex": "github-copilot",
          "openrouter/anthropic/claude-opus-4.6": "openrouter",
          "google/gemini-3.1-pro-preview": "google",
          "google/gemini-3-pro-preview": "google",
        };

        // Agent -> default provider mapping (when model is null)
        const AGENT_DEFAULT_PROVIDER: Record<string, string> = {
          "coding": "ollama",
          "research": "ollama",
          "general": "ollama",
        };

        // Extract provider key from a model ID (e.g. "nvidia/llama-3.1" → "nvidia")
        const providerKeyFromModel = (modelId: string): string => {
          // Check explicit map first
          const mapped = PROVIDER_MODEL_MAP[modelId];
          if (mapped) return mapped;
          // Fallback: extract prefix before first "/"
          const slashIdx = modelId.indexOf("/");
          if (slashIdx > 0) return modelId.substring(0, slashIdx);
          return modelId;
        };

        const isAvailable = (name: string | null): boolean => {
          if (name === null) return false;
          
          // Extract the provider key (handles model IDs like "google/gemini-..." → "google")
          const providerKey = name.includes("/") ? providerKeyFromModel(name) : name;
          
          const p = status[providerKey];
          if (!p || typeof p !== "object") return true; // unknown provider → assume available
          return p.available !== false;
        };

        const taskType = args.task_type ?? "coding";
        const complexity = args.complexity ?? "simple";

        // ── Routing Table ──────────────────────────────────────────
        interface RouteEntry {
          agent: string;
          model: string | null;
          display: string;
        }

        const table: Record<string, Record<string, RouteEntry[]>> = {
          coding: {
            simple: [
              { agent: "coding", model: null, display: "Ollama Kimi-K2.5 (local, cheap)" },
              { agent: "coding", model: "google/gemini-3.1-pro-preview", display: "Antigravity Gemini 3.1 Pro (free)" },
              { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex (94% quota)" },
            ],
            medium: [
              { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex (94% quota)" },
              { agent: "coding", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
              { agent: "coding", model: "google/gemini-3.1-pro-preview", display: "Antigravity Gemini 3.1 Pro (free)" },
            ],
            complex: [
              { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
              { agent: "coding", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
              { agent: "coding", model: "google/gemini-3.1-pro-preview", display: "Antigravity Gemini 3.1 Pro (free)" },
            ],
          },
          vision: {
            any: [
              { agent: "image-analysis", model: "google/gemini-3.1-pro-preview", display: "Antigravity Gemini 3.1 Pro (free)" },
              { agent: "browser", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
              { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
            ],
          },
          research: {
            simple: [
              { agent: "research", model: "google/gemini-3-pro-preview", display: "Antigravity Gemini 3 Pro (free)" },
              { agent: "research", model: null, display: "Ollama Qwen3.5 (local, fast)" },
            ],
            complex: [
              { agent: "research", model: "google/gemini-3-pro-preview", display: "Antigravity Gemini 3 Pro (free)" },
              { agent: "browser", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
              { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
            ],
          },
          browser: {
            any: [
              { agent: "browser", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
              { agent: "browser", model: "google/gemini-3.1-pro-preview", display: "Antigravity Gemini 3.1 Pro (free)" },
            ],
          },
          chat: {
            simple: [
              { agent: "general", model: null, display: "Ollama Qwen3.5 (local, fast)" },
              { agent: "general", model: "google/gemini-3.1-pro-preview", display: "Antigravity Gemini 3.1 Pro (free)" },
            ],
          },
        };

        const taskRoutes = table[taskType] ?? table.coding;
        const routes = taskRoutes[complexity] ?? taskRoutes.simple ?? taskRoutes.any ?? taskRoutes[Object.keys(taskRoutes)[0]];

        const tried: RouteEntry[] = [];
        let chosen: RouteEntry | null = null;

        for (const entry of routes) {
          tried.push(entry);
          
          let providerToCheck: string | null = entry.model;
          if (providerToCheck === null) {
            // When model is null, use the agent's default provider
            providerToCheck = AGENT_DEFAULT_PROVIDER[entry.agent] ?? null;
          }
          
          if (isAvailable(providerToCheck)) {
            chosen = entry;
            break;
          }
        }

        if (chosen) {
          return JSON.stringify(
            {
              agent: chosen.agent,
              model: chosen.model,
              display: chosen.display,
              available: true,
              reason: `Selected: ${chosen.display}`,
              task_type: taskType,
              complexity,
              tried: tried.map((t) => ({ agent: t.agent, model: t.model, display: t.display })),
            },
            null,
            2
          );
        }

        return JSON.stringify(
          {
            available: false,
            error: `No available provider for ${taskType}/${complexity}`,
            tried: tried.map((t) => ({ agent: t.agent, model: t.model, display: t.display })),
          },
          null,
          2
        );
      },
    }),

    check_providers: tool({
      description:
        "Check availability and quota of all AI providers (Copilot, Ollama, OpenRouter, Antigravity, OpenAI). Returns JSON with provider status.",
      args: {
        force: tool.schema.boolean().optional().default(false),
      },
      execute: async (args) => {
        return await runProviderStatus(args.force ?? false);
      },
    }),

    get_quota: tool({
      description:
        "Get quota summary for all providers. Returns Copilot %, OpenAI status, etc.",
      args: {
        force: tool.schema.boolean().optional().default(false),
      },
      execute: async (args) => {
        const raw = await runProviderStatus(args.force ?? false);
        try {
          const status = JSON.parse(raw);
          const quota: Record<string, any> = {};
          for (const [key, val] of Object.entries(status)) {
            if (typeof val === "object" && val !== null && "quota_left" in (val as any)) {
              quota[key] = {
                quota: (val as any).quota_left,
                available: (val as any).available,
              };
            }
          }
          if (status.copilot_quota !== undefined) {
            quota.copilot_pct = status.copilot_quota;
          }
          return JSON.stringify(quota, null, 2);
        } catch {
          return raw;
        }
      },
    }),
  },
});

export default plugin;
