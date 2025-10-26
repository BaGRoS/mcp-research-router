# MCP Research Router

### Modular MCP server for multi-provider AI research aggregation

**MCP Research Router** is a TypeScript-based MCP server that routes and aggregates research queries in parallel across **Gemini**, **DeepSeek**, **OpenAI**, and **Perplexity** APIs.

It supports multiple questions, result synthesis, Markdown report generation, and transparent provenance reporting.

---

## 🚀 Quick Start

### 1. Installation

You can run the MCP Research Router directly via **npx** — no manual installation required:

```bash
npx -y @bagros/mcp-research-router@latest
```

### 2. Add to your MCP client (e.g., Claude Desktop)

Edit your MCP configuration file (usually `config.json`):

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

This securely passes API keys as environment variables without storing them in your repository.

---

## 🧩 Features

* Parallel research execution across **multiple AI providers**
* Supports **multi-question** jobs
* Automatic **deduplication and synthesis** of results
* Optional **Markdown report generation (.md)**
* Detailed **provenance tracking** (providers, models, timing, cost)
* Compatible with **Claude Desktop** and **MCP Inspector**
* Distributed via **npm** and auto-updated via `@latest`

---

## 🛠️ Tools Exposed via MCP

| Tool              | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `research.run`    | Executes multi-provider, multi-question research jobs |
| `research.status` | Returns metrics for current or recent tasks           |
| `research.models` | Lists supported models per provider                   |
| `research.save`   | Forces saving synthesized results to Markdown         |

---

## 🧠 Data Flow

1. Input validation (JSON Schema / Zod)
2. Parallel provider execution (p-limit / Bottleneck)
3. Aggregation and deduplication
4. Synthesis using LLM (e.g., OpenAI, Gemini)
5. Output as JSON, Markdown, or file path

---

## 📁 Repository Structure

```
mcp-research-router/
├─ src/
│  ├─ cli.ts            # Entry point for MCP STDIO
│  ├─ server.ts         # Registers tools & capabilities
│  ├─ tools/            # MCP tools (research.run, status, etc.)
│  ├─ adapters/         # Provider connectors (OpenAI, Gemini, etc.)
│  ├─ synth/            # Deduplication and synthesis
│  ├─ utils/            # Helpers (http, md, rateLimit, logging)
│  ├─ schema/           # JSON Schemas for tool inputs
│  └─ types.ts          # Shared types
├─ reports/             # Generated .md reports (ignored)
├─ logs/                # Rotated JSONL logs (ignored)
├─ .gitignore           # Based on Node template
├─ tsconfig.json        # TypeScript config
└─ package.json         # Project manifest
```

---

## ⚙️ Development

```bash
git clone https://github.com/BaGRoS/mcp-research-router.git
cd mcp-research-router
pnpm install
pnpm build
node dist/cli.js
```

Test locally using **MCP Inspector** to browse tools, schemas, and results.

---

## 📦 Publishing to npm

```bash
npm login
npm publish --access public
```

Use `dist-tags` for stability management:

```bash
npm publish --tag beta
npm dist-tag add @bagros/mcp-research-router@0.3.0 latest
```

---

## 🔐 Environment Variables

| Variable             | Description        |
| -------------------- | ------------------ |
| `OPENAI_API_KEY`     | OpenAI API key     |
| `GOOGLE_API_KEY`     | Gemini 2.5 API key |
| `PERPLEXITY_API_KEY` | Perplexity API key |
| `DEEPSEEK_API_KEY`   | DeepSeek API key   |

---

## 🧾 License

**MIT License**
© 2025 Mirosław Bagrowski (@BaGRoS)

---

## 🌐 Links

* GitHub: [https://github.com/BaGRoS/mcp-research-router](https://github.com/BaGRoS/mcp-research-router)
* npm: [https://www.npmjs.com/package/@bagros/mcp-research-router](https://www.npmjs.com/package/@bagros/mcp-research-router)
* MCP Inspector: [https://modelcontextprotocol.io/tools](https://modelcontextprotocol.io/tools)

---

**Build flexible, transparent, and future-proof MCP research integrations.**
