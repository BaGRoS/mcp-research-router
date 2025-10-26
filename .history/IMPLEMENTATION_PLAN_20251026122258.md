# MCP Research Router - Implementation Plan

## Task 2: Project Foundation Files

This document specifies the exact content needed for the project foundation files.

---

## 1. package.json

**Location**: `./package.json`

```json
{
  "name": "@bagros/mcp-research-router",
  "version": "0.1.0",
  "description": "Modular MCP server for multi-provider AI research aggregation",
  "main": "dist/cli.js",
  "type": "module",
  "bin": {
    "mcp-research-router": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "prepublishOnly": "npm run build",
    "clean": "rm -rf dist"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "ai",
    "research",
    "openai",
    "gemini",
    "perplexity",
    "deepseek",
    "aggregation"
  ],
  "author": "Mirosław Bagrowski (@BaGRoS)",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/BaGRoS/mcp-research-router.git"
  },
  "bugs": {
    "url": "https://github.com/BaGRoS/mcp-research-router/issues"
  },
  "homepage": "https://github.com/BaGRoS/mcp-research-router#readme",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "bottleneck": "^2.19.5",
    "p-limit": "^5.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3",
    "tsx": "^4.7.1"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

**Key Points:**
- Package name scoped to `@bagros`
- Type is `module` for ES modules
- Binary entry point for `npx` execution
- MCP SDK version 1.0.4 or later
- Node 18+ required

---

## 2. tsconfig.json

**Location**: `./tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node"]
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
```

**Key Points:**
- ES2022 target for modern JavaScript features
- NodeNext module system for ESM support
- Strict mode enabled for type safety
- Source maps and declaration files generated
- Output to `dist/` directory

---

## 3. .env.example

**Location**: `./.env.example`

```bash
# OpenAI API Configuration
# Get your key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-key-here

# Google Gemini API Configuration
# Get your key from: https://aistudio.google.com/app/apikey
GOOGLE_API_KEY=AIzaSy-your-key-here

# Perplexity API Configuration
# Get your key from: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=pplx-your-key-here

# DeepSeek API Configuration
# Get your key from: https://platform.deepseek.com/api_keys
DEEPSEEK_API_KEY=sk-your-key-here

# Optional Configuration
# LOG_LEVEL=info
# MAX_RETRIES=3
# TIMEOUT_MS=30000
```

**Key Points:**
- Clear documentation for each API key
- Links to where users can get their keys
- Example format for each key type
- Optional configuration parameters commented out

---

## 4. .gitignore Updates

**Location**: `./.gitignore`

**Additional entries to add:**
```gitignore
# Project-specific
reports/
logs/
*.jsonl

# Build artifacts
dist/
build/

# Environment files
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary files
tmp/
temp/
*.tmp
```

**Note**: The existing `.gitignore` already covers most Node.js patterns. These additions are specific to this project.

---

## 5. Directory Structure Creation

Create the following empty directories:

```
mkdir -p src/tools
mkdir -p src/adapters
mkdir -p src/synth
mkdir -p src/utils
mkdir -p src/schema
mkdir -p reports
mkdir -p logs
```

**Purpose:**
- `src/tools/` - MCP tool implementations
- `src/adapters/` - Provider API connectors
- `src/synth/` - Synthesis and deduplication logic
- `src/utils/` - Helper utilities
- `src/schema/` - JSON schemas for validation
- `reports/` - Generated Markdown reports (gitignored)
- `logs/` - Rotating log files (gitignored)

---

## 6. .gitkeep Files

For empty directories that should be tracked in git:

**Create `.gitkeep` in:**
- `src/tools/.gitkeep`
- `src/adapters/.gitkeep`
- `src/synth/.gitkeep`
- `src/utils/.gitkeep`
- `src/schema/.gitkeep`

**Do NOT create .gitkeep in:**
- `reports/` (gitignored)
- `logs/` (gitignored)

---

## Implementation Checklist

When implementing task 2, create the following files in order:

- [ ] `package.json` - Project manifest
- [ ] `tsconfig.json` - TypeScript configuration
- [ ] `.env.example` - Environment variable template
- [ ] Update `.gitignore` with project-specific entries
- [ ] Create directory structure (`src/`, `reports/`, `logs/`)
- [ ] Create `.gitkeep` files in source directories

---

## Verification Steps

After creating these files:

1. **Validate package.json**: Run `npm install` to verify dependencies
2. **Validate tsconfig.json**: Run `tsc --noEmit` to check configuration
3. **Verify directory structure**: Run `find src -type d` to list directories
4. **Check gitignore**: Run `git status` to ensure reports/ and logs/ are ignored

---

## Next Steps

After task 2 is complete, proceed to:
- **Task 3**: Create TypeScript type definitions in `src/types.ts`
- **Task 4**: Implement utility modules
- **Task 5**: Build provider adapters

This completes the foundation layer needed for all subsequent development.