# MCP Research Router – Developer Guide

## Overview

**MCP Research Router** is a modular TypeScript-based MCP server designed to route and aggregate research queries across multiple AI providers – **Gemini, DeepSeek, OpenAI, and Perplexity** – in parallel. It supports multi-question execution, result synthesis, Markdown report generation, and detailed provenance logging for all providers.

This document provides a complete guide for developers to build, structure, and publish the MCP Research Router.

---

## 1. Project Goals

* Provide a flexible, extensible MCP server for research aggregation.
* Execute queries **in parallel** across multiple APIs.
* Support **multi-question** input with independent processing.
* Perform **synthesis and deduplication** of collected results using a final LLM.
* Optionally save the synthesized result as a **.md report**.
* Integrate seamlessly with MCP clients (e.g., Claude Desktop, MCP Inspector).
* Accept API keys securely via **environment variables** during registration.

---

## 2. Core Technologies

* **Language:** TypeScript
* **Runtime:** Node.js (v18+)
* **Protocol:** MCP (Model Context Protocol)
* **SDK:** `@modelcontextprotocol/sdk`
* **Package Manager:** `pnpm` or `npm`
* **Version Control:** Git / GitHub

---

## 3. Repository Structure

```
mcp-research-router/
├─ src/
│  ├─ cli.ts                  # Entry point (bin) for npx execution
│  ├─ server.ts               # MCP bootstrap & tool registration
│  ├─ tools/                  # Tools exposed via MCP (API entrypoints)
│  │  ├─ researchRun.ts       # Main parallel execution logic
│  │  ├─ researchStatus.ts    # Status & metrics tracking
│  │  ├─ researchModels.ts    # Provider model listing (cached)
│  │  └─ researchSave.ts      # Manual save to Markdown
│  ├─ adapters/               # Provider connectors
│  │  ├─ openai.ts
│  │  ├─ gemini.ts
│  │  ├─ perplexity.ts
│  │  └─ deepseek.ts
│  ├─ synth/                  # Synthesis & deduplication logic
│  │  └─ synthesize.ts
│  ├─ schema/                 # JSON Schemas for input validation
│  │  └─ research.run.json
│  ├─ utils/                  # Helper modules
│  │  ├─ http.ts              # Fetch wrapper with retry/backoff
│  │  ├─ rateLimit.ts         # Bottleneck/p-limit control per provider
│  │  ├─ cost.ts              # API cost estimation utilities
│  │  ├─ md.ts                # Markdown report writer
│  │  └─ log.ts               # JSONL logger (stderr + rotating logs)
│  ├─ types.ts                # Shared interfaces and types
│  └─ version.ts              # Version export
├─ reports/                   # Generated Markdown reports (.gitignored)
├─ logs/                      # Rotating log files (.gitignored)
├─ .env.example               # Example environment variable file
├─ .gitignore                 # Based on GitHub Node template + custom entries
├─ package.json               # Project manifest and metadata
├─ tsconfig.json              # TypeScript configuration
├─ README.md                  # End-user documentation
└─ LICENSE                    # License file (MIT recommended)
```

---

## 4. Environment Variables

The router relies on API keys passed through the environment. These should be provided **by the user** during MCP server registration.

| Variable             | Description                                      |
| -------------------- | ------------------------------------------------ |
| `OPENAI_API_KEY`     | OpenAI API key for synthesis or research queries |
| `GOOGLE_API_KEY`     | Gemini 2.5 API key                               |
| `PERPLEXITY_API_KEY` | Perplexity Sonar API key                         |
| `DEEPSEEK_API_KEY`   | DeepSeek Chat API key                            |

> Sensitive keys must **never** be logged to stdout. Use `stderr` or log files for debugging if necessary.

---

## 5. MCP Integration

The MCP server communicates with clients (Claude Desktop, MCP Inspector) via **STDIO transport**.

### Handshake & Capabilities

Upon initialization, the server declares its capabilities:

* `tools` → Lists all available research operations.
* `resources` → (optional) Provides access to saved reports.
* `prompts` → (optional) Predefined prompt templates.

Clients discover these via `tools/list`, `resources/list`, or `prompts/list`.

### Tool Exposure

The router exposes four primary MCP tools:

1. **`research.run`** – Executes parallel research queries.
2. **`research.status`** – Returns runtime metrics.
3. **`research.models`** – Lists available models per provider.
4. **`research.save`** – Forces Markdown export.

Each tool has its own **JSON Schema** for input validation and UI auto-generation in clients like MCP Inspector.

---

## 6. Data Flow

1. **Input validation** – Arguments are validated using Zod/JSON Schema.
2. **Task expansion** – Cartesian product of providers × questions.
3. **Parallel execution** – Managed via `p-limit` and Bottleneck for per-provider rate limiting.
4. **Result aggregation** – Collected via `Promise.allSettled`.
5. **Synthesis** – Results combined and deduplicated using a chosen model.
6. **Output** – Either:

   * JSON (structured results)
   * Markdown (synthesized report)
   * Saved file path (if `return: "file"`)

---

## 7. Event & Logging System

The server emits structured MCP notifications:

* `provider_started` / `provider_finished`
* `synthesis_started` / `synthesis_finished`
* `saved_file`

Each includes provider name, model, question ID, latency, and cost estimate.

All logs are stored in `./logs/*.jsonl` with automatic rotation.

---

## 8. File Output Format (.md)

Reports contain YAML front matter followed by human-readable summaries.

### Front Matter Example

```yaml
---
title: "Research Summary: {topic}"
date: "2025-10-21T10:12:00Z"
providers:
  - { name: perplexity, model: sonar-pro }
  - { name: deepseek, model: deepseek-chat }
summary:
  questions:
    - { id: q1, text: "First question" }
metrics:
  totalLatencyMs: 18500
  costEstimateUSD:
    openai: 0.02
    gemini: 0.00
    perplexity: 0.04
---
```

### Report Body

* **Synthesized key findings** (deduplicated)
* **Citations & URLs** (mainly from Perplexity)
* **Contradictions or differences between providers**

---

## 9. Provider Adapters

Each provider has its own adapter module implementing a common interface:

* API endpoint URL
* Authentication header (Bearer token)
* Request/response mapping
* Optional citation/usage extraction
* Timeout and retry logic

Providers currently supported:

* **OpenAI Responses API**
* **Gemini 2.5 API**
* **Perplexity Sonar API**
* **DeepSeek Chat API**

---

## 10. Parallelism and Stability

* Global concurrency: `p-limit(6)`
* Per-provider throttling via Bottleneck
* Exponential backoff retries (250–2000 ms)
* Timeout per request (`timeoutMs` option)
* Circuit breaker for unstable providers (e.g., DeepSeek outages)

---

## 11. Configuration for Users

When adding this MCP server to a client, users specify environment variables inline.

### Example (Claude Desktop `config.json`)

```json
{
  "mcpServers": {
    "research-router": {
      "command": "npx",
      "args": ["-y", "@bagros/mcp-research-router@latest"],
      "env": {
        "OPENAI_API_KEY": "sk-***",
        "GOOGLE_API_KEY": "AIza***",
        "PERPLEXITY_API_KEY": "pplx-***",
        "DEEPSEEK_API_KEY": "sk-***"
      }
    }
  }
}
```

This ensures keys are never stored in the repo.

---

## 12. Development Workflow

1. **Clone repository**
2. **Install dependencies**

   ```bash
   pnpm install
   ```
3. **Build project**

   ```bash
   pnpm build
   ```
4. **Run locally**

   ```bash
   node dist/cli.js
   ```
5. **Test with MCP Inspector** (recommended)

   * Run MCP Inspector
   * Connect to local STDIO server
   * Inspect tools, input schemas, and results

---

## 13. Publishing to npm

1. Log in: `npm login`
2. Build: `pnpm build`
3. Publish:

   ```bash
   npm publish --access public
   ```
4. Use dist-tags:

   * `latest` for stable builds
   * `beta` for testing

   ```bash
   npm publish --tag beta
   npm dist-tag add @bagros/mcp-research-router@0.3.0 latest
   ```

Users can then launch it directly:

```bash
npx -y @bagros/mcp-research-router@latest
```

---

## 14. Recommended .gitignore

Based on GitHub’s **Node** template, plus custom entries:

```
# Node base
tmp/
node_modules/
dist/
build/
coverage/
*.log

# Env & secrets
.env
.env.local
.env.*.local

# Reports & logs
reports/
logs/
*.jsonl

# Editors
.vscode/
.idea/
.DS_Store
```

---

## 15. Optional Enhancements

* Add `research.cache` (LRU cache per provider/question)
* Add advanced `synthesis` strategies (strict, weighted, consensus)
* Add resource discovery (`resources/list`) for report history
* Integrate CI/CD pipeline via GitHub Actions (lint, build, test, publish)

---

## 16. Licensing & Attribution

* **License:** MIT (recommended)
* **Maintainer:** `Mirosław Bagrowski (@BaGRoS)`
* **Repository:** `https://github.com/BaGRoS/mcp-research-router`
* **Package name:** `@bagros/mcp-research-router`

---

## 17. Summary Checklist

✅ TypeScript MCP server using STDIO transport
✅ Parallel multi-provider research (Gemini, DeepSeek, OpenAI, Perplexity)
✅ JSON Schema for input validation
✅ `.md` synthesis report generation
✅ Event logging and metrics
✅ Distributed via npm (`npx -y @bagros/mcp-research-router@latest`)
✅ Secure API key handling via env
✅ Ready for integration with Claude Desktop and MCP Inspector
