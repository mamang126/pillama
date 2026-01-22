/**
 * Utility functions for Ollama API compatibility
 */

/**
 * Parse keep_alive duration string to milliseconds
 * @param {string} keepAlive - Duration string like "5m", "10s", "1h"
 * @returns {number} Milliseconds
 */
function parseKeepAlive(keepAlive) {
  if (typeof keepAlive === 'number') {
    return keepAlive;
  }

  if (!keepAlive) {
    return 5 * 60 * 1000; // Default 5 minutes
  }

  const match = keepAlive.match(/^(\d+)([smh])$/);
  if (!match) {
    return 5 * 60 * 1000;
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return 5 * 60 * 1000;
  }
}

/**
 * Convert Ollama options to hailo parameters
 * @param {object} options - Ollama options object
 * @returns {object} Hailo parameters
 */
function convertOptionsToHailoParams(options = {}) {
  return {
    temperature: options.temperature ?? 0.8,
    max_tokens: options.num_predict ?? 2048,
    seed: options.seed,
    top_k: options.top_k,
    top_p: options.top_p,
  };
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Format model name (ensure it has a tag)
 * @param {string} modelName - Model name
 * @returns {string} Formatted model name
 */
function formatModelName(modelName) {
  if (!modelName) {
    return 'llama3.2:latest';
  }
  
  // If no tag is specified, add :latest
  if (!modelName.includes(':')) {
    return `${modelName}:latest`;
  }
  
  return modelName;
}

/**
 * Extract base model name without tag
 * @param {string} modelName - Full model name with tag
 * @returns {string} Base model name
 */
function getBaseModelName(modelName) {
  return modelName.split(':')[0];
}

/**
 * Create an Ollama-compatible error response
 * @param {string} error - Error message
 * @returns {object} Error response
 */
function createErrorResponse(error) {
  return {
    error: error,
  };
}

/**
 * Calculate digest (mock implementation)
 * @param {string} modelName - Model name
 * @returns {string} Digest hash
 */
function calculateDigest(modelName) {
  // In a real implementation, this would be a proper hash
  // For now, return a mock digest
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(modelName).digest('hex').substring(0, 32);
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  parseKeepAlive,
  convertOptionsToHailoParams,
  getCurrentTimestamp,
  formatModelName,
  getBaseModelName,
  createErrorResponse,
  calculateDigest,
  formatBytes,
};
