# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Research Router is a TypeScript-based MCP (Model Context Protocol) server that routes and aggregates research queries in parallel across multiple AI providers: **Gemini**, **DeepSeek**, **OpenAI**, and **Perplexity**. It supports multi-question execution, result synthesis, Markdown report generation, and transparent provenance reporting.

This is published as an npm package (`@bagros/mcp-research-router`) and runs via STDIO transport in MCP clients like Claude Desktop.

## Development Commands

### Build and Development
```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Run in development mode (tsx)
pnpm dev

# Clean build artifacts
pnpm clean
```

### Testing
Use **MCP Inspector** (https://modelcontextprotocol.io/tools) to test tools locally:
```bash
pnpm build
node dist/cli.js
```

### Publishing to npm
```bash
npm login
npm publish --access public

# Beta releases
npm publish --tag beta
npm dist-tag add @bagros/mcp-research-router@0.3.0 latest
```

## Architecture

### Core Data Flow
1. **Input Validation**: JSON Schema (Zod) validates tool inputs (src/schema/)
2. **Parallel Execution**: Provider queries run in parallel using Promise.allSettled with rate limiting (p-limit, Bottleneck)
3. **Aggregation**: Results are collected and deduplicated
4. **Synthesis**: Optional LLM-powered synthesis via OpenAI Responses API (gpt-5-mini default)
5. **Output**: JSON, Markdown, or saved to reports/ directory

### Directory Structure
```
src/
├── cli.ts                # Entry point, STDIO transport initialization
├── server.ts             # MCP server setup, tool registration
├── types.ts              # Comprehensive shared type definitions
├── tools/                # MCP tool implementations
│   ├── researchRun.ts    # Main research execution tool
│   ├── researchStatus.ts # Status metrics tool
│   ├── researchModels.ts # Model listing tool
│   └── researchSave.ts   # Report saving tool
├── adapters/             # Provider-specific implementations
│   ├── openai.ts         # OpenAI Responses API (gpt-5/gpt-5-mini/gpt-5-nano)
│   ├── gemini.ts         # Google Gemini 2.5
│   ├── perplexity.ts     # Perplexity API
│   └── deepseek.ts       # DeepSeek API
├── synth/                # Synthesis and aggregation logic
│   └── synthesize.ts     # LLM-powered synthesis, deduplication
├── utils/                # Utility modules
│   ├── http.ts           # HTTP client with retry/backoff
│   ├── cost.ts           # Cost estimation per provider
│   ├── md.ts             # Markdown report generation with YAML frontmatter
│   ├── rateLimit.ts      # Rate limiting (Bottleneck)
│   ├── log.ts            # Structured JSONL logging
│   └── debug.ts          # Debug mode with detailed Markdown logs
└── schema/               # JSON Schema definitions for tools
```

## Key Architecture Patterns

### Provider Adapter Pattern
All providers implement the `ProviderAdapter` interface (src/types.ts:187-214):
- `query()`: Execute research query
- `listModels()`: Return available models
- `validateConfig()`: Check API key presence
- `getDefaultModel()`: Return default model

Each adapter is registered in `ADAPTERS` map (src/tools/researchRun.ts:40-44) and selected dynamically at runtime.

### Parallel Query Execution
src/tools/researchRun.ts:141-153 creates a task matrix (providers × questions) and executes all queries with `Promise.allSettled()`. Rate limiting per provider is handled via `withRateLimit()` wrapper (src/utils/rateLimit.ts).

### Synthesis Pipeline
src/synth/synthesize.ts implements two modes:
1. **LLM Synthesis** (default): Uses OpenAI Responses API to merge, deduplicate, and highlight contradictions across provider results
2. **Aggregation Only**: Simple concatenation when synthesis is disabled or fails

The synthesis prompt (src/synth/synthesize.ts:56-124) instructs the model to:
- Merge key findings into coherent narrative
- Remove duplicate information
- Highlight contradictions explicitly
- Preserve all citations and sources

### Status Tracking
Global `lastRunStatus` variable (src/tools/researchRun.ts:50) tracks per-provider metrics:
- Success/failure rates
- Average latency
- Cost estimates

This is exposed via `research.status` tool.

### Logging and Notifications
src/utils/log.ts implements a dual-format logging system with organized directory structure:

**Directory Structure:**
```
logs/
├── jsonl/           # Machine-readable JSONL logs (for parsing/monitoring)
│   └── YYYY-MM-DD/  # Organized by date
│       └── session-HH-MM-SS.jsonl
├── sessions/        # Human-readable session logs (always enabled)
│   └── YYYY-MM-DD/  # Organized by date
│       └── session-HH-MM-SS.md
└── debug/           # Detailed debug logs (only when DEBUG=1)
    └── debug-session-TIMESTAMP.md
```

**Features:**
- **JSONL Logs**: Machine-readable JSON Lines format for automated parsing and monitoring
- **Session Logs**: Human-readable Markdown format with emojis, formatted timestamps, and organized metadata
- **Automatic Rotation**: Keeps last 30 days of logs per type
- **Event Types**: provider_started, provider_finished, synthesis_started, synthesis_finished, etc.
- **All logs written to stderr** to avoid interfering with STDIO MCP transport

### Debug Mode
src/utils/debug.ts provides detailed debugging capabilities when `DEBUG=1`:
- Creates comprehensive Markdown debug logs in `logs/debug/`
- Captures full request/response details for all providers
- Logs synthesis prompts and responses (with truncation for readability)
- Includes timing, costs, and token usage statistics
- Generates session summary with per-provider metrics
- Automatic rotation (keeps last 20 debug sessions)
- Custom log directory via `DEBUG_LOG_DIR` environment variable

## Environment Variables

### Required API Keys
Required for each provider you want to use:
```
OPENAI_API_KEY       # OpenAI API key
GOOGLE_API_KEY       # Gemini 2.5 API key
PERPLEXITY_API_KEY   # Perplexity API key
DEEPSEEK_API_KEY     # DeepSeek API key
```

Providers without configured API keys are skipped with appropriate error messages.

### Debug Mode (Optional)
Enable detailed debug logging:
```
DEBUG=1              # Enable debug mode
MCP_DEBUG=1          # Alternative debug flag
DEBUG_LOG_DIR=/path  # Custom log directory (optional, defaults to current working directory)
```

When enabled, creates detailed Markdown debug logs in `logs/debug/` directory (or `DEBUG_LOG_DIR/debug/` if custom path is set) containing:
- Full provider requests and responses
- Question text and timestamps
- Response content (truncated for readability)
- Token usage and cost estimates
- Synthesis prompts and results
- Per-provider and session-wide statistics

Debug logs are human-readable and ideal for:
- Troubleshooting provider issues
- Analyzing cost and latency patterns
- Reviewing synthesis quality
- Understanding system behavior

**Example: Enabling debug mode in Claude Desktop config:**
```json
{
  "mcpServers": {
    "research-router": {
      "command": "npx",
      "args": ["-y", "@bagros/mcp-research-router"],
      "env": {
        "DEBUG": "1",
        "DEBUG_LOG_DIR": "/Users/yourname/Projects/your-project",
        "OPENAI_API_KEY": "sk-...",
        "GOOGLE_API_KEY": "...",
        "PERPLEXITY_API_KEY": "...",
        "DEEPSEEK_API_KEY": "..."
      }
    }
  }
}
```

**Important:** Set `DEBUG_LOG_DIR` to the directory where you want debug logs saved. The system will create a `debug/` subdirectory there. If not set, logs will be saved in the current working directory (which may be the npm package installation directory when using npx).

## MCP Tools

### research.run
Main execution tool. Accepts:
- `providers`: Array of provider names
- `questions`: Array of `{id, text}` objects
- `synthesis`: Boolean (enable LLM synthesis)
- `synthModel`: Model for synthesis (default: gpt-5-mini)
- `return`: Output format (json/markdown/file)
- `timeoutMs`: Request timeout
- `maxRetries`: Retry attempts per provider

### research.status
Returns metrics from last run (per-provider stats, latency, costs).

### research.models
Lists available models per provider with defaults.

### research.save
Saves last synthesis result to reports/ as Markdown with YAML frontmatter.

## Important Implementation Details

### TypeScript Module System
Uses ES modules (`"type": "module"` in package.json) with:
- `NodeNext` module resolution (tsconfig.json:5)
- All imports must include `.js` extension (even for .ts files)
- JSON imports use `with { type: 'json' }` syntax (src/server.ts:19)

### STDIO Transport
The MCP server communicates via STDIO (stdin/stdout). All logs and diagnostics MUST be written to stderr to avoid corrupting the MCP protocol stream. See src/cli.ts:21-51 for graceful shutdown handling.

### Error Handling
- Provider failures return `ProviderResult` with `error` field populated (src/types.ts:101-122)
- Synthesis failures fall back to `aggregateWithoutSynthesis()` (src/tools/researchRun.ts:182)
- Custom error classes: `ProviderError` and `SynthesisError` (src/types.ts:372-394)

### Rate Limiting
src/utils/rateLimit.ts uses Bottleneck to enforce per-provider rate limits:
- OpenAI: 50 requests/minute
- Gemini: 60 requests/minute
- Perplexity: 20 requests/minute
- DeepSeek: 30 requests/minute

### Cost Estimation
src/utils/cost.ts provides per-provider cost estimates based on model and typical token usage. These are approximations for user visibility, not precise billing.

## Development Notes

### Adding a New Provider
1. Create adapter in src/adapters/ implementing `ProviderAdapter` interface
2. Add provider to `Provider` union type (src/types.ts:14)
3. Register adapter in `ADAPTERS` map (src/tools/researchRun.ts:40-44)
4. Add rate limit configuration (src/utils/rateLimit.ts)
5. Add cost estimates (src/utils/cost.ts)
6. Update schema to include new provider (src/schema/research.run.json)

### Modifying Synthesis Logic
Synthesis prompt is in src/synth/synthesize.ts:56-124. Key considerations:
- Preserve all citations from Perplexity and OpenAI web_search
- Group results by question ID for clarity
- Instruct model to avoid hallucinating sources
- Keep prompt concise to minimize synthesis cost

### Debugging with MCP Inspector
Run locally with:
```bash
pnpm build && node dist/cli.js
```
Then connect MCP Inspector to browse tool definitions, test inputs, and view raw responses.
