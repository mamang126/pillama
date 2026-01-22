const WebSocket = require('ws');
const { EventEmitter } = require('events');

/**
 * Client for communicating with Python hailo service via WebSocket
 */
class HailoClient extends EventEmitter {
  constructor(config) {
    super();
    this.host = config.python_service.host;
    this.port = config.python_service.ws_port;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.requestCallbacks = new Map();
  }

  /**
   * Connect to the Python WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://${this.host}:${this.port}`;
      console.log(`Connecting to Python service at ${wsUrl}...`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('Connected to Python hailo service');
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Python service');
        this.emit('disconnected');
        this.attemptReconnect();
      });
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay}ms... (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, delay);
  }

  /**
   * Send a request and handle streaming responses
   */
  async sendStreamingRequest(action, params, onChunk) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const chunks = [];
      let finalData = null;

      const messageHandler = (message) => {
        if (message.type === 'error') {
          this.removeListener('message', messageHandler);
          reject(new Error(message.content));
          return;
        }

        if (message.type === 'token') {
          chunks.push(message.content);
          if (onChunk) {
            onChunk(message);
          }
        } else if (message.type === 'complete') {
          this.removeListener('message', messageHandler);
          finalData = message;
          resolve({ chunks, finalData });
        }
      };

      this.on('message', messageHandler);

      const request = { action, ...params };
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Send a request and wait for a single response
   */
  async sendRequest(action, params) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      const messageHandler = (message) => {
        if (message.type === 'error') {
          this.removeListener('message', messageHandler);
          reject(new Error(message.content));
        } else {
          this.removeListener('message', messageHandler);
          resolve(message);
        }
      };

      this.on('message', messageHandler);

      const request = { action, ...params };
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Check if the client is connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Close the connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = HailoClient;
