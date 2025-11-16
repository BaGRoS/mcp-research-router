/**
 * MCP Server Bootstrap
 * 
 * Initializes the MCP server with STDIO transport and registers all tools.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { researchRun } from './tools/researchRun.js';
import { researchStatus, researchStatusFormatted } from './tools/researchStatus.js';
import { researchModels, researchModelsFormatted } from './tools/researchModels.js';
import { researchSave } from './tools/researchSave.js';
import { initLogging, closeSessionLog } from './utils/log.js';
import { initDebugLogging, closeDebugLog } from './utils/debug.js';
import researchRunSchema from './schema/research.run.json' with { type: 'json' };

/**
 * MCP server instance
 */
const server = new Server(
  {
    name: 'mcp-research-router',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

/**
 * Tool definitions for MCP
 */
const TOOLS: Tool[] = [
  {
    name: 'research.run',
    description: 'Execute parallel research queries across multiple AI providers (OpenAI, Gemini, Perplexity, DeepSeek). Supports multi-question execution, result synthesis, and various output formats.',
    inputSchema: researchRunSchema as any
  },
  {
    name: 'research.status',
    description: 'Get runtime metrics and status from the last research run, including per-provider statistics, success rates, latency, and costs.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          default: 'json',
          description: 'Output format'
        }
      }
    }
  },
  {
    name: 'research.models',
    description: 'List all available models per provider with their default selections.',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'markdown'],
          default: 'json',
          description: 'Output format'
        },
        provider: {
          type: 'string',
          enum: ['openai', 'gemini', 'perplexity', 'deepseek'],
          description: 'Optional: filter by specific provider'
        }
      }
    }
  },
  {
    name: 'research.save',
    description: 'Save the last synthesis result to a Markdown file in the reports/ directory.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Optional custom filename (without path)',
          pattern: '^[a-zA-Z0-9_-]+\\.md$'
        }
      }
    }
  }
];

/**
 * Register tool handlers
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'research.run': {
        const result = await researchRun(args as any);
        return {
          content: [
            {
              type: 'text',
              text: result.content
            }
          ]
        };
      }

      case 'research.status': {
        const format = (args as any)?.format || 'json';
        const status = format === 'markdown' 
          ? researchStatusFormatted() 
          : JSON.stringify(researchStatus(), null, 2);
        
        return {
          content: [
            {
              type: 'text',
              text: status
            }
          ]
        };
      }

      case 'research.models': {
        const format = (args as any)?.format || 'json';
        const models = format === 'markdown'
          ? researchModelsFormatted()
          : JSON.stringify(researchModels(), null, 2);
        
        return {
          content: [
            {
              type: 'text',
              text: models
            }
          ]
        };
      }

      case 'research.save': {
        const filename = (args as any)?.filename;
        const result = researchSave(filename);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: (error as Error).message,
            tool: name
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

/**
 * Start the MCP server
 */
export async function startServer(): Promise<void> {
  // Initialize logging
  initDebugLogging();
  initLogging();

  // Create STDIO transport
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  console.error(JSON.stringify({
    level: 'info',
    event: 'server_started',
    message: 'MCP Research Router server started',
    timestamp: new Date().toISOString()
  }));
}

/**
 * Shutdown handler
 */
export async function stopServer(): Promise<void> {
  // Close session log before shutting down
  closeSessionLog();
  closeDebugLog();

  await server.close();

  console.error(JSON.stringify({
    level: 'info',
    event: 'server_stopped',
    message: 'MCP Research Router server stopped',
    timestamp: new Date().toISOString()
  }));
}

/**
 * Export server instance for testing
 */
export { server };
