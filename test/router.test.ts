import test from "node:test";
import assert from "node:assert/strict";
import {
  routeTask,
  providerKeyFromModel,
  isProviderAvailable,
  ROUTING_TABLE,
  PROVIDER_MODEL_MAP,
} from "../dist/index.js";

test("Provider Router Fallback Chain", async (t) => {
  await t.test("maps Groq and Mistral model IDs correctly", () => {
    assert.equal(PROVIDER_MODEL_MAP["groq/llama-3.3-70b-versatile"], "groq");
    assert.equal(PROVIDER_MODEL_MAP["mistral/codestral-latest"], "mistral");
    assert.equal(PROVIDER_MODEL_MAP["mistral/mistral-large-latest"], "mistral");

    assert.equal(providerKeyFromModel("groq/llama-3.3-70b-versatile"), "groq");
    assert.equal(providerKeyFromModel("mistral/codestral-latest"), "mistral");
  });

  await t.test("routes to primary provider when available", () => {
    const status = {
      google: { available: true },
      groq: { available: true },
      mistral: { available: true },
    };

    const result = routeTask("coding", "simple", status);
    assert.equal(result.available, true);
    assert.equal(result.model, "google/gemini-3.1-pro-preview");
    assert.equal(result.agent, "coding");
  });

  await t.test("falls back to Groq when primary Google provider is down", () => {
    const status = {
      google: { available: false },
      groq: { available: true },
      mistral: { available: true },
    };

    const result = routeTask("coding", "simple", status);
    assert.equal(result.available, true);
    assert.equal(result.model, "groq/llama-3.3-70b-versatile");
    assert.equal(result.display, "Groq LLaMA 3.3 70B");
  });

  await t.test("falls back to Mistral when Google and Groq are both down", () => {
    const status = {
      google: { available: false },
      groq: { available: false },
      mistral: { available: true },
    };

    const result = routeTask("coding", "simple", status);
    assert.equal(result.available, true);
    assert.equal(result.model, "mistral/codestral-latest");
    assert.equal(result.display, "Mistral Codestral");
  });

  await t.test("falls back to Copilot when Google, Groq, and Mistral are down", () => {
    const status = {
      google: { available: false },
      groq: { available: false },
      mistral: { available: false },
      "github-copilot": { available: true },
    };

    const result = routeTask("coding", "simple", status);
    assert.equal(result.available, true);
    assert.equal(result.model, "github-copilot/gpt-5.3-codex");
  });

  await t.test("falls back to Ollama as ultimate fallback when cloud providers are down", () => {
    const status = {
      google: { available: false },
      groq: { available: false },
      mistral: { available: false },
      "github-copilot": { available: false },
      openrouter: { available: false },
      ollama: { available: true },
    };

    const result = routeTask("coding", "simple", status);
    assert.equal(result.available, true);
    assert.equal(result.model, null);
    assert.equal(result.display, "Ollama (last resort)");
  });

  await t.test("routes complex research queries with Mistral and Groq options", () => {
    const status = {
      google: { available: false },
      mistral: { available: true },
      groq: { available: true },
    };

    const result = routeTask("research", "complex", status);
    assert.equal(result.available, true);
    assert.equal(result.model, "mistral/mistral-large-latest");
  });

  await t.test("handles completely unavailable status gracefully", () => {
    const status = {
      google: { available: false },
      groq: { available: false },
      mistral: { available: false },
      "github-copilot": { available: false },
      openrouter: { available: false },
      ollama: { available: false },
    };

    const result = routeTask("coding", "simple", status);
    assert.equal(result.available, false);
    assert.ok(result.error?.includes("No available provider"));
  });
});
