#!/usr/bin/env node
/**
 * MCP Research Router - CLI Entry Point
 * 
 * Starts the MCP server with STDIO transport.
 * This file is the executable entry point when running via npx.
 */

import { startServer, stopServer } from './server.js';

/**
 * Main entry point
 */
async function main() {
  try {
    // Start the MCP server
    await startServer();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error(JSON.stringify({
        level: 'info',
        event: 'shutdown_signal',
        message: 'Received SIGINT, shutting down gracefully',
        timestamp: new Date().toISOString()
      }));
      
      await stopServer();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error(JSON.stringify({
        level: 'info',
        event: 'shutdown_signal',
        message: 'Received SIGTERM, shutting down gracefully',
        timestamp: new Date().toISOString()
      }));
      
      await stopServer();
      process.exit(0);
    });

  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'startup_failed',
      message: `Failed to start MCP server: ${(error as Error).message}`,
      error: (error as Error).stack,
      timestamp: new Date().toISOString()
    }));
    
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'fatal_error',
    message: `Fatal error: ${(error as Error).message}`,
    error: (error as Error).stack,
    timestamp: new Date().toISOString()
  }));
  
  process.exit(1);
});