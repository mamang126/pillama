const express = require('express');
const fs = require('fs');
const path = require('path');
const HailoClient = require('./hailo-client');
const createRoutes = require('./routes/ollama');

/**
 * Main Express server
 */
class Server {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = null;
    this.app = express();
    this.hailoClient = null;
    this.server = null;
  }

  /**
   * Load configuration from JSON file
   */
  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log('Configuration loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      return false;
    }
  }

  /**
   * Initialize Hailo client
   */
  async initializeHailoClient() {
    this.hailoClient = new HailoClient(this.config);
    
    try {
      await this.hailoClient.connect();
      console.log('Hailo client initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Hailo client:', error.message);
      console.error('Make sure the Python service is running:');
      console.error('  python python_service/hailo_service.py');
      return false;
    }
  }

  /**
   * Setup Express middleware and routes
   */
  setupExpress() {
    // Middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path}`);
      next();
    });

    // Mount Ollama API routes
    const routes = createRoutes(this.hailoClient, this.config);
    this.app.use('/', routes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Pillama - Hailo Ollama API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          chat: 'POST /api/chat',
          generate: 'POST /api/generate',
          tags: 'GET /api/tags',
          show: 'POST /api/show',
          ps: 'GET /api/ps',
          health: 'GET /api/health',
        },
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });

    console.log('Express middleware and routes configured');
  }

  /**
   * Start the server
   */
  async start() {
    // Load configuration
    if (!this.loadConfig()) {
      process.exit(1);
    }

    // Initialize Hailo client
    if (!await this.initializeHailoClient()) {
      process.exit(1);
    }

    // Setup Express
    this.setupExpress();

    // Start listening
    const host = this.config.server.host;
    const port = this.config.server.port;

    return new Promise((resolve) => {
      this.server = this.app.listen(port, host, () => {
        console.log('\n' + '='.repeat(60));
        console.log('🚀 Pillama Server Started');
        console.log('='.repeat(60));
        console.log(`📍 Address: http://${host}:${port}`);
        console.log(`🔗 Python Service: ws://${this.config.python_service.host}:${this.config.python_service.ws_port}`);
        console.log(`📊 Health Check: http://${host}:${port}/api/health`);
        console.log('='.repeat(60) + '\n');
        resolve();
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    console.log('\nShutting down server...');

    if (this.hailoClient) {
      this.hailoClient.close();
      console.log('Hailo client closed');
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Express server closed');
          resolve();
        });
      });
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const configPath = path.join(__dirname, '..', 'config.json');
  const server = new Server(configPath);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT signal');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM signal');
    await server.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Start the server
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = Server;
