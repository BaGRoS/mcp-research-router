# MCP Research Router - Deployment Guide

## Prerequisites

Before publishing to npm, ensure you have:

1. **npm account** - Sign up at [npmjs.com](https://www.npmjs.com/)
2. **npm CLI authenticated** - Run `npm login`
3. **Git repository** - Code committed and pushed to GitHub
4. **Clean working directory** - No uncommitted changes

## Pre-Publishing Checklist

### 1. Verify Package Configuration

Check [`package.json`](package.json:1) contains:

- ✅ Correct package name: `@bagros/mcp-research-router`
- ✅ Valid version number (semantic versioning)
- ✅ Proper `bin` entry pointing to compiled CLI
- ✅ `files` array including `dist/` folder
- ✅ All dependencies listed correctly
- ✅ Repository URL and author information

### 2. Build and Test Locally

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Verify build output
ls dist/

# Test the CLI locally
node dist/cli.js

# Test as npx package (dry run)
npm pack
```

This creates a `.tgz` file you can test with:

```bash
npm install -g ./bagros-mcp-research-router-0.1.0.tgz
mcp-research-router
```

### 3. Verify Files to be Published

```bash
# See what will be included in the package
npm pack --dry-run
```

Expected contents:
- `dist/` folder (compiled JavaScript)
- `package.json`
- `README.md`
- `LICENSE`

Should **NOT** include:
- `src/` folder (TypeScript source)
- `node_modules/`
- `.env` files
- `logs/` or `reports/` directories

## Publishing Steps

### Step 1: Login to npm

```bash
npm login
```

Enter your npm credentials when prompted.

### Step 2: Build for Production

```bash
# Clean previous builds
rm -rf dist/

# Fresh install
npm ci

# Build
npm run build
```

### Step 3: Version Bump (Optional)

Follow [semantic versioning](https://semver.org/):

```bash
# Patch release (0.1.0 → 0.1.1)
npm version patch

# Minor release (0.1.0 → 0.2.0)
npm version minor

# Major release (0.1.0 → 1.0.0)
npm version major
```

This automatically:
- Updates version in [`package.json`](package.json:3)
- Creates git commit
- Creates git tag

### Step 4: Publish to npm

```bash
# Publish as public package
npm publish --access public
```

For beta releases:

```bash
# Publish with beta tag
npm publish --access public --tag beta
```

### Step 5: Verify Publication

```bash
# Check package info
npm info @bagros/mcp-research-router

# Test installation
npx @bagros/mcp-research-router@latest
```

## Post-Publishing

### 1. Tag Management

```bash
# View current tags
npm dist-tag ls @bagros/mcp-research-router

# Move 'latest' tag to specific version
npm dist-tag add @bagros/mcp-research-router@0.2.0 latest

# Add 'beta' tag
npm dist-tag add @bagros/mcp-research-router@0.2.1 beta
```

### 2. Push Git Tags

```bash
git push origin main --tags
```

### 3. Create GitHub Release

1. Go to GitHub repository
2. Click "Releases" → "Create a new release"
3. Select the version tag
4. Add release notes
5. Publish release

## Usage After Publishing

### Via npx (Recommended for MCP)

Users can run directly without installation:

```bash
npx @bagros/mcp-research-router@latest
```

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "research-router": {
      "command": "npx",
      "args": ["-y", "@bagros/mcp-research-router@latest"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "GOOGLE_API_KEY": "AIza...",
        "PERPLEXITY_API_KEY": "pplx-...",
        "DEEPSEEK_API_KEY": "sk-..."
      }
    }
  }
}
```

### MCP Inspector Testing

```bash
# Run MCP Inspector
npx @modelcontextprotocol/inspector npx @bagros/mcp-research-router@latest
```

## Version Strategy

### Semantic Versioning

- **MAJOR** (1.0.0) - Breaking API changes
- **MINOR** (0.1.0) - New features, backwards compatible
- **PATCH** (0.0.1) - Bug fixes, backwards compatible

### Recommended Tags

- `latest` - Stable production release
- `beta` - Testing/preview features
- `next` - Development branch

Example workflow:

```bash
# Release beta version
npm version prerelease --preid=beta
npm publish --tag beta

# When stable, promote to latest
npm dist-tag add @bagros/mcp-research-router@0.2.0-beta.1 latest
```

## Troubleshooting

### Permission Denied

```bash
# Check you're logged in
npm whoami

# Re-authenticate
npm logout
npm login
```

### Package Name Taken

If `@bagros/mcp-research-router` is unavailable:

1. Change package name in [`package.json`](package.json:2)
2. Update documentation
3. Try alternative scope or name

### Build Errors

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Verify TypeScript compiles
npx tsc --noEmit
```

### Missing Files in Package

Check [`package.json`](package.json:1) `files` array:

```json
{
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

## Unpublishing (Emergency Only)

⚠️ **Warning**: Only unpublish within 72 hours of publishing.

```bash
# Unpublish specific version
npm unpublish @bagros/mcp-research-router@0.1.0

# Unpublish entire package (DANGEROUS)
npm unpublish @bagros/mcp-research-router --force
```

## Continuous Deployment (Optional)

### GitHub Actions Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Add `NPM_TOKEN` to GitHub repository secrets.

## Support and Maintenance

### Update Dependencies

```bash
# Check for outdated packages
npm outdated

# Update dependencies
npm update

# Update package.json
npx npm-check-updates -u
npm install
```

### Security Audits

```bash
# Run security audit
npm audit

# Fix vulnerabilities automatically
npm audit fix
```

## Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Package**: `@bagros/mcp-research-router`  
**Author**: Mirosław Bagrowski (@BaGRoS)  
**License**: MIT  
**Repository**: https://github.com/BaGRoS/mcp-research-router