import { tool, type PluginInput, type Hooks } from "@opencode-ai/plugin";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";

const execAsync = promisify(exec);
const PROVIDER_STATUS_SCRIPT = join(homedir(), "bin", "provider-status");

export async function runProviderStatus(force: boolean = false): Promise<string> {
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

export interface RouteEntry {
  agent: string;
  model: string | null;
  display: string;
}

export interface RouteResult {
  agent?: string;
  model?: string | null;
  display?: string;
  available: boolean;
  reason?: string;
  task_type?: string;
  complexity?: string;
  tried: RouteEntry[];
  error?: string;
}

// Map model IDs to their provider key in the status dict
export const PROVIDER_MODEL_MAP: Record<string, string> = {
  "github-copilot/gpt-5.3-codex": "github-copilot",
  "openrouter/anthropic/claude-opus-4.6": "openrouter",
  "google/gemini-3.1-pro-preview": "google",
  "google/gemini-3-pro-preview": "google",
  "groq/llama-3.3-70b-versatile": "groq",
  "groq/deepseek-r1-distill-llama-70b": "groq",
  "mistral/codestral-latest": "mistral",
  "mistral/mistral-large-latest": "mistral",
};

// Agent -> default provider mapping (when model is null)
export const AGENT_DEFAULT_PROVIDER: Record<string, string> = {
  coding: "ollama",
  research: "ollama",
  general: "ollama",
  browser: "ollama",
  "image-analysis": "ollama",
};

export const providerKeyFromModel = (modelId: string): string => {
  const mapped = PROVIDER_MODEL_MAP[modelId];
  if (mapped) return mapped;
  const slashIdx = modelId.indexOf("/");
  if (slashIdx > 0) return modelId.substring(0, slashIdx);
  return modelId;
};

export const isProviderAvailable = (
  name: string | null,
  status: Record<string, any>
): boolean => {
  if (name === null) return false;

  const providerKey = name.includes("/") ? providerKeyFromModel(name) : name;
  const p = status[providerKey];
  if (!p || typeof p !== "object") return true; // unknown provider → assume available
  return p.available !== false;
};

// ── Routing Table with Groq & Mistral Fallbacks ──────────────────────────────────
export const ROUTING_TABLE: Record<string, Record<string, RouteEntry[]>> = {
  coding: {
    simple: [
      { agent: "coding", model: "google/gemini-3.1-pro-preview", display: "Google AI Studio Gemini 3.1 Pro (free)" },
      { agent: "coding", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
      { agent: "coding", model: "mistral/codestral-latest", display: "Mistral Codestral" },
      { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
      { agent: "coding", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "coding", model: null, display: "Ollama (last resort)" },
    ],
    medium: [
      { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
      { agent: "coding", model: "mistral/codestral-latest", display: "Mistral Codestral" },
      { agent: "coding", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
      { agent: "coding", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "coding", model: "google/gemini-3.1-pro-preview", display: "Google AI Studio Gemini 3.1 Pro (free)" },
      { agent: "coding", model: null, display: "Ollama (last resort)" },
    ],
    complex: [
      { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
      { agent: "coding", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "coding", model: "mistral/mistral-large-latest", display: "Mistral Large" },
      { agent: "coding", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
      { agent: "coding", model: "google/gemini-3.1-pro-preview", display: "Google AI Studio Gemini 3.1 Pro (free)" },
      { agent: "coding", model: null, display: "Ollama (last resort)" },
    ],
  },
  vision: {
    any: [
      { agent: "image-analysis", model: "google/gemini-3.1-pro-preview", display: "Google AI Studio Gemini 3.1 Pro (free)" },
      { agent: "browser", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
      { agent: "image-analysis", model: "mistral/mistral-large-latest", display: "Mistral Large" },
    ],
  },
  research: {
    simple: [
      { agent: "research", model: "google/gemini-3-pro-preview", display: "Google AI Studio Gemini 3 Pro (free)" },
      { agent: "research", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
      { agent: "research", model: "mistral/mistral-large-latest", display: "Mistral Large" },
      { agent: "research", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "research", model: null, display: "Ollama (last resort)" },
    ],
    complex: [
      { agent: "research", model: "google/gemini-3-pro-preview", display: "Google AI Studio Gemini 3 Pro (free)" },
      { agent: "research", model: "mistral/mistral-large-latest", display: "Mistral Large" },
      { agent: "research", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
      { agent: "browser", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "coding", model: "github-copilot/gpt-5.3-codex", display: "Copilot GPT-5.3 Codex" },
    ],
  },
  browser: {
    any: [
      { agent: "browser", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "browser", model: "google/gemini-3.1-pro-preview", display: "Google AI Studio Gemini 3.1 Pro (free)" },
      { agent: "browser", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
    ],
  },
  chat: {
    simple: [
      { agent: "general", model: "google/gemini-3.1-pro-preview", display: "Google AI Studio Gemini 3.1 Pro (free)" },
      { agent: "general", model: "groq/llama-3.3-70b-versatile", display: "Groq LLaMA 3.3 70B" },
      { agent: "general", model: "mistral/mistral-large-latest", display: "Mistral Large" },
      { agent: "general", model: "openrouter/anthropic/claude-opus-4.6", display: "OpenRouter Claude Opus 4.6" },
      { agent: "general", model: null, display: "Ollama (last resort)" },
    ],
  },
};

export function routeTask(
  taskType: string = "coding",
  complexity: string = "simple",
  status: Record<string, any> = {}
): RouteResult {
  const taskRoutes = ROUTING_TABLE[taskType] ?? ROUTING_TABLE.coding;
  const routes =
    taskRoutes[complexity] ??
    taskRoutes.simple ??
    taskRoutes.any ??
    taskRoutes[Object.keys(taskRoutes)[0]];

  const tried: RouteEntry[] = [];
  let chosen: RouteEntry | null = null;

  for (const entry of routes) {
    tried.push(entry);

    let providerToCheck: string | null = entry.model;
    if (providerToCheck === null) {
      providerToCheck = AGENT_DEFAULT_PROVIDER[entry.agent] ?? null;
    }

    if (isProviderAvailable(providerToCheck, status)) {
      chosen = entry;
      break;
    }
  }

  if (chosen) {
    return {
      agent: chosen.agent,
      model: chosen.model,
      display: chosen.display,
      available: true,
      reason: `Selected: ${chosen.display}`,
      task_type: taskType,
      complexity,
      tried,
    };
  }

  return {
    available: false,
    error: `No available provider for ${taskType}/${complexity}`,
    tried,
  };
}

const plugin = async (_input: PluginInput): Promise<Hooks> => ({
  tool: {
    route_task: tool({
      description:
        "Find the best available model/agent for a task type. Uses cost-aware routing with fallback chains (including Groq and Mistral). Returns JSON with agent name, model ID, and reasoning.",
      args: {
        task_type: tool.schema.enum(["coding", "vision", "research", "browser", "chat"]),
        complexity: tool.schema.enum(["simple", "medium", "complex", "any"]).optional().default("simple"),
      },
      execute: async (args) => {
        const statusRaw = await runProviderStatus();
        let status: Record<string, any> = {};
        try {
          status = JSON.parse(statusRaw);
        } catch {
          return JSON.stringify({ error: "Failed to parse provider status" });
        }

        const taskType = args.task_type ?? "coding";
        const complexity = args.complexity ?? "simple";
        const result = routeTask(taskType, complexity, status);

        return JSON.stringify(result, null, 2);
      },
    }),

    check_providers: tool({
      description:
        "Check availability and quota of all AI providers (Copilot, Ollama, OpenRouter, Google, Groq, Mistral, OpenAI). Returns JSON with provider status.",
      args: {
        force: tool.schema.boolean().optional().default(false),
      },
      execute: async (args) => {
        return await runProviderStatus(args.force ?? false);
      },
    }),

    get_quota: tool({
      description:
        "Get quota summary for all providers. Returns Copilot %, Groq/Mistral status, OpenAI status, etc.",
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
