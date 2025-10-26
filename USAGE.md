# MCP Research Router - Usage Guide

## Quick Start

The simplest way to use MCP Research Router is via `npx` with Claude Desktop or any MCP-compatible client.

## Installation Methods

### Method 1: Via npx (Recommended)

No installation needed - run directly:

```bash
npx @bagros/mcp-research-router@latest
```

### Method 2: Global Installation

```bash
npm install -g @bagros/mcp-research-router
mcp-research-router
```

### Method 3: Local Project

```bash
npm install @bagros/mcp-research-router
npx mcp-research-router
```

## Claude Desktop Integration

### Configuration File Location

**Windows**:
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS**:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux**:
```
~/.config/Claude/claude_desktop_config.json
```

### Basic Configuration

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "research-router": {
      "command": "npx",
      "args": ["-y", "@bagros/mcp-research-router@latest"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-...",
        "GOOGLE_API_KEY": "AIza...",
        "PERPLEXITY_API_KEY": "pplx-...",
        "DEEPSEEK_API_KEY": "sk-..."
      }
    }
  }
}
```

### Configuration with Specific Providers

Enable only selected providers:

```json
{
  "mcpServers": {
    "research-router": {
      "command": "npx",
      "args": ["-y", "@bagros/mcp-research-router@latest"],
      "env": {
        "OPENAI_API_KEY": "sk-proj-...",
        "PERPLEXITY_API_KEY": "pplx-..."
      }
    }
  }
}
```

The router will automatically skip providers without API keys.

### Restart Claude Desktop

After editing configuration:

1. **Quit Claude Desktop completely**
2. Restart the application
3. Check for the research-router tools in the tool menu

## Available Tools

### 1. research.run

Execute parallel research queries across multiple AI providers.

**Parameters**:

- `providers` (required): Array of provider names
  - Options: `"openai"`, `"gemini"`, `"perplexity"`, `"deepseek"`
  - Example: `["openai", "perplexity"]`

- `questions` (required): Array of research questions
  - Example: `["What is quantum computing?", "Latest AI breakthroughs?"]`

- `models` (optional): Provider-specific models
  - Example: `{ "openai": "gpt-5-mini", "gemini": "gemini-2.5-flash" }`

- `synthesis` (optional): LLM model for synthesis
  - Default: `"gpt-5-mini"`
  - Options: `"gpt-5"`, `"gpt-5-mini"`, `"gpt-5-nano"`

- `return` (optional): Output format
  - Options: `"json"` (default), `"markdown"`, `"file"`

- `save` (optional): Auto-save to file
  - Type: `boolean`
  - Default: `false`

**Example Usage in Claude**:

```
Use research.run to search for "latest developments in quantum computing" 
using OpenAI and Perplexity, then synthesize the results.
```

Claude will call the tool with appropriate parameters.

### 2. research.status

Get current runtime metrics and statistics.

**Returns**:
- Total queries executed
- Success/failure counts per provider
- Average latency per provider
- Total estimated costs
- Rate limiter queue status

**Example**:

```
Check the research router status
```

### 3. research.models

List available models for each provider.

**Parameters**:

- `provider` (optional): Specific provider name
  - If omitted, lists models for all providers

**Example**:

```
Show me available models for Gemini
```

### 4. research.save

Manually save the last research results to a Markdown file.

**Parameters**:

- `filepath` (optional): Custom file path
  - Default: `./reports/research-{timestamp}.md`

**Example**:

```
Save the last research results to a file
```

## Usage Examples

### Example 1: Basic Research Query

**Prompt to Claude**:

```
Research "What are the latest trends in AI safety?" using OpenAI and Perplexity
```

**What happens**:
1. Claude calls [`research.run`](src/tools/researchRun.ts:1)
2. Query sent to both providers in parallel
3. Results synthesized using GPT-5-mini
4. Summary returned to Claude
5. Claude presents findings to you

### Example 2: Multi-Question Research

**Prompt**:

```
I need research on three topics:
1. Current state of quantum computing
2. Recent breakthroughs in fusion energy
3. Progress in carbon capture technology

Use all available providers and save the results to a file
```

**Result**:
- 12 parallel queries (4 providers × 3 questions)
- Synthesized comprehensive report
- Saved to `./reports/research-2025-10-26.md`

### Example 3: Provider Comparison

**Prompt**:

```
Compare how different AI providers answer: "What is the capital of France?"
Use OpenAI, Gemini, Perplexity, and DeepSeek
```

**Result**:
- Shows answer from each provider
- Highlights any differences or contradictions
- Useful for validating information

### Example 4: Cost-Effective Research

**Prompt**:

```
Research "machine learning basics" using only the most cost-effective model
```

Claude will configure:
```json
{
  "providers": ["gemini"],
  "models": { "gemini": "gemini-2.5-flash" },
  "synthesis": "gpt-5-nano"
}
```

## Output Formats

### JSON Output (Default)

```json
{
  "summary": "Synthesized findings...",
  "sources": [
    {
      "provider": "perplexity",
      "model": "sonar-pro",
      "answer": "...",
      "citations": ["https://..."]
    }
  ],
  "metadata": {
    "totalLatencyMs": 5432,
    "costEstimateUSD": {
      "openai": 0.002,
      "perplexity": 0.004
    }
  }
}
```

### Markdown Output

```markdown
# Research Summary: Quantum Computing

*Generated: 2025-10-26T10:30:00Z*

## Key Findings

1. **Current State**: Quantum computers with 1000+ qubits...
2. **Recent Breakthroughs**: Google's quantum error correction...

## Sources

- **Perplexity (sonar-pro)**: [Link](https://...)
- **OpenAI (gpt-5)**: Analysis of...

## Contradictions

- Perplexity reported 1000 qubits
- DeepSeek mentioned 1121 qubits
```

### File Output

Saved to `./reports/research-2025-10-26T10-30-00.md` with:
- YAML front matter (metadata)
- Human-readable summary
- Provenance for all sources
- Cost and latency metrics

## Advanced Usage

### Rate Limiting

The router automatically manages:
- **Global limit**: 6 concurrent requests
- **Per-provider limit**: 2 requests/second

No configuration needed - handled automatically.

### Cost Optimization

Estimated costs per 1000 tokens:

| Provider | Model | Cost |
|----------|-------|------|
| OpenAI | gpt-5-nano | $0.001 |
| OpenAI | gpt-5-mini | $0.003 |
| OpenAI | gpt-5 | $0.015 |
| Gemini | gemini-2.5-flash | $0.000 (free tier) |
| Perplexity | sonar | $0.001 |
| Perplexity | sonar-pro | $0.003 |
| DeepSeek | deepseek-chat | $0.001 |

### Error Handling

The router handles:
- **API failures**: Continues with other providers
- **Rate limits**: Automatic backoff and retry
- **Timeout**: 30-second default per request
- **Invalid responses**: Logged and skipped

### Logging

All events logged to:
- **stderr**: Real-time console output
- **File**: `./logs/research-router-YYYY-MM-DD.jsonl`

Logs include:
- Request/response timing
- Cost estimates
- Error details
- Provider metrics

## MCP Inspector Testing

Test the server before using with Claude:

```bash
# Install MCP Inspector
npm install -g @modelcontextprotocol/inspector

# Run with the research router
npx @modelcontextprotocol/inspector npx @bagros/mcp-research-router@latest
```

Features:
- Interactive tool testing
- Request/response inspection
- Schema validation
- Real-time logging

## Troubleshooting

### Tools Not Appearing in Claude

1. Check configuration file location
2. Verify JSON syntax (use validator)
3. Ensure API keys are set
4. Restart Claude Desktop completely
5. Check Claude's MCP logs

### API Key Errors

```
Error: OPENAI_API_KEY not found
```

**Solution**: Add API key to `env` section in configuration.

### Rate Limit Errors

```
Error: Rate limit exceeded for provider: perplexity
```

**Solution**: Router handles automatically with backoff. If persistent, reduce concurrent requests.

### Module Not Found

```
Error: Cannot find module '@bagros/mcp-research-router'
```

**Solution**: 
- Check internet connection
- Run: `npm cache clean --force`
- Try: `npx -y @bagros/mcp-research-router@latest`

### Synthesis Failures

```
Error: Synthesis failed with gpt-5-mini
```

**Solution**: 
- Check OPENAI_API_KEY is valid
- Verify OpenAI account has credits
- Try different synthesis model

## Best Practices

### 1. Provider Selection

- **Speed**: Gemini Flash (fastest)
- **Citations**: Perplexity (best citations)
- **Depth**: OpenAI GPT-5 (most detailed)
- **Cost**: Gemini Flash (free tier)

### 2. Question Formatting

**Good**:
```
"What are the latest developments in quantum computing as of 2025?"
```

**Better**:
```
"List the top 3 breakthrough achievements in quantum computing from 2024-2025, 
including organizations involved and qubit counts achieved"
```

### 3. Synthesis Configuration

- Use `gpt-5-nano` for simple summaries
- Use `gpt-5-mini` for balanced analysis (default)
- Use `gpt-5` for complex synthesis with deep analysis

### 4. Cost Management

```
Total = (Provider Queries × Cost) + (Synthesis Cost)
```

Example for 2 questions × 3 providers:
- 6 queries @ $0.001 each = $0.006
- 1 synthesis @ $0.003 = $0.003
- **Total: ~$0.009**

## API Key Management

### Getting API Keys

1. **OpenAI**: https://platform.openai.com/api-keys
2. **Google AI Studio**: https://makersuite.google.com/app/apikey
3. **Perplexity**: https://www.perplexity.ai/settings/api
4. **DeepSeek**: https://platform.deepseek.com/api_keys

### Security Best Practices

- ✅ Store keys in configuration file (not in code)
- ✅ Use environment-specific configurations
- ✅ Rotate keys periodically
- ✅ Monitor usage and costs
- ❌ Never commit keys to version control
- ❌ Don't share configuration files

## Resources

- **GitHub Repository**: https://github.com/BaGRoS/mcp-research-router
- **npm Package**: https://www.npmjs.com/package/@bagros/mcp-research-router
- **MCP Documentation**: https://modelcontextprotocol.io/
- **Issue Tracker**: https://github.com/BaGRoS/mcp-research-router/issues

## Support

For questions, issues, or feature requests:

1. Check existing documentation
2. Search GitHub issues
3. Create new issue with:
   - Error message
   - Configuration (redact API keys)
   - Steps to reproduce

---

**Version**: 0.1.0  
**Author**: Mirosław Bagrowski (@BaGRoS)  
**License**: MIT