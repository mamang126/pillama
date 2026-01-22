const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  getCurrentTimestamp,
  formatModelName,
  convertOptionsToHailoParams,
  createErrorResponse,
  calculateDigest,
} = require('../utils');

/**
 * Create Ollama API routes
 */
function createRoutes(hailoClient, config) {
  const router = express.Router();

  /**
   * POST /api/generate - Generate completion from a prompt
   */
  router.post('/api/generate', async (req, res) => {
    const { model, prompt, stream = true, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json(createErrorResponse('Prompt is required'));
    }

    const modelName = formatModelName(model || config.hailo.default_model);
    const hailoParams = convertOptionsToHailoParams(options);

    try {
      if (stream) {
        // Set headers for streaming response
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');

        const startTime = Date.now();

        // Stream tokens
        await hailoClient.sendStreamingRequest(
          'generate',
          {
            prompt,
            model: modelName,
            stream: true,
            ...hailoParams,
          },
          (chunk) => {
            // Send each token as a separate JSON object
            const response = {
              model: modelName,
              created_at: getCurrentTimestamp(),
              response: chunk.content,
              done: false,
            };
            res.write(JSON.stringify(response) + '\n');
          }
        ).then(({ finalData }) => {
          // Send final response with stats
          const finalResponse = {
            model: modelName,
            created_at: getCurrentTimestamp(),
            response: '',
            done: true,
            context: [],
            total_duration: finalData.total_duration || (Date.now() - startTime) * 1e6,
            load_duration: finalData.load_duration || 0,
            prompt_eval_count: finalData.prompt_eval_count || 0,
            prompt_eval_duration: finalData.prompt_eval_duration || 0,
            eval_count: finalData.eval_count || 0,
            eval_duration: finalData.eval_duration || 0,
          };
          res.write(JSON.stringify(finalResponse) + '\n');
          res.end();
        }).catch(error => {
          console.error('Streaming error:', error);
          res.write(JSON.stringify(createErrorResponse(error.message)) + '\n');
          res.end();
        });
      } else {
        // Non-streaming response
        const startTime = Date.now();
        const result = await hailoClient.sendStreamingRequest(
          'generate',
          {
            prompt,
            model: modelName,
            stream: false,
            ...hailoParams,
          },
          null
        );

        const fullResponse = result.chunks.join('');
        const finalData = result.finalData;

        res.json({
          model: modelName,
          created_at: getCurrentTimestamp(),
          response: fullResponse,
          done: true,
          context: [],
          total_duration: finalData.total_duration || (Date.now() - startTime) * 1e6,
          load_duration: finalData.load_duration || 0,
          prompt_eval_count: finalData.prompt_eval_count || 0,
          prompt_eval_duration: finalData.prompt_eval_duration || 0,
          eval_count: finalData.eval_count || 0,
          eval_duration: finalData.eval_duration || 0,
        });
      }
    } catch (error) {
      console.error('Generate error:', error);
      res.status(500).json(createErrorResponse(error.message));
    }
  });

  /**
   * POST /api/chat - Generate a chat completion
   */
  router.post('/api/chat', async (req, res) => {
    const { model, messages, stream = true, options = {} } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json(createErrorResponse('Messages array is required'));
    }

    const modelName = formatModelName(model || config.hailo.default_model);
    const hailoParams = convertOptionsToHailoParams(options);

    try {
      if (stream) {
        // Set headers for streaming response
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');

        const startTime = Date.now();

        // Stream tokens
        await hailoClient.sendStreamingRequest(
          'chat',
          {
            messages,
            model: modelName,
            stream: true,
            ...hailoParams,
          },
          (chunk) => {
            // Send each token as a separate JSON object
            const response = {
              model: modelName,
              created_at: getCurrentTimestamp(),
              message: {
                role: 'assistant',
                content: chunk.content,
              },
              done: false,
            };
            res.write(JSON.stringify(response) + '\n');
          }
        ).then(({ finalData }) => {
          // Send final response with stats
          const finalResponse = {
            model: modelName,
            created_at: getCurrentTimestamp(),
            message: {
              role: 'assistant',
              content: '',
            },
            done: true,
            total_duration: finalData.total_duration || (Date.now() - startTime) * 1e6,
            load_duration: finalData.load_duration || 0,
            prompt_eval_count: finalData.prompt_eval_count || 0,
            prompt_eval_duration: finalData.prompt_eval_duration || 0,
            eval_count: finalData.eval_count || 0,
            eval_duration: finalData.eval_duration || 0,
          };
          res.write(JSON.stringify(finalResponse) + '\n');
          res.end();
        }).catch(error => {
          console.error('Streaming error:', error);
          res.write(JSON.stringify(createErrorResponse(error.message)) + '\n');
          res.end();
        });
      } else {
        // Non-streaming response
        const startTime = Date.now();
        const result = await hailoClient.sendStreamingRequest(
          'chat',
          {
            messages,
            model: modelName,
            stream: false,
            ...hailoParams,
          },
          null
        );

        const fullResponse = result.chunks.join('');
        const finalData = result.finalData;

        res.json({
          model: modelName,
          created_at: getCurrentTimestamp(),
          message: {
            role: 'assistant',
            content: fullResponse,
          },
          done: true,
          total_duration: finalData.total_duration || (Date.now() - startTime) * 1e6,
          load_duration: finalData.load_duration || 0,
          prompt_eval_count: finalData.prompt_eval_count || 0,
          prompt_eval_duration: finalData.prompt_eval_duration || 0,
          eval_count: finalData.eval_count || 0,
          eval_duration: finalData.eval_duration || 0,
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json(createErrorResponse(error.message));
    }
  });

  /**
   * GET /api/tags - List available models
   */
  router.get('/api/tags', async (req, res) => {
    try {
      const response = await hailoClient.sendRequest('list_models', {});
      const models = response.data || [];

      const formattedModels = models.map(model => ({
        name: model.name,
        modified_at: getCurrentTimestamp(),
        size: model.size || 0,
        digest: calculateDigest(model.name),
        details: {
          format: model.format || 'hef',
          family: model.family || 'unknown',
          parameter_size: model.parameter_size || 'unknown',
          quantization_level: 'Q4_K_M',
        },
      }));

      res.json({ models: formattedModels });
    } catch (error) {
      console.error('Tags error:', error);
      res.status(500).json(createErrorResponse(error.message));
    }
  });

  /**
   * POST /api/show - Show model information
   */
  router.post('/api/show', async (req, res) => {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json(createErrorResponse('Model name is required'));
    }

    const modelName = formatModelName(model);

    try {
      const response = await hailoClient.sendRequest('model_info', { model: modelName });

      if (response.type === 'error') {
        return res.status(404).json(createErrorResponse('Model not found'));
      }

      const modelInfo = response.data;

      res.json({
        modelfile: `# Hailo Model\nFROM ${modelInfo.hef_path}`,
        parameters: `temperature 0.8\nnum_predict 2048`,
        template: '{{ .System }}\n{{ .Prompt }}',
        details: {
          format: modelInfo.format || 'hef',
          family: modelInfo.family || 'unknown',
          parameter_size: modelInfo.parameter_size || 'unknown',
        },
      });
    } catch (error) {
      console.error('Show error:', error);
      res.status(500).json(createErrorResponse(error.message));
    }
  });

  /**
   * GET /api/ps - List running models
   */
  router.get('/api/ps', async (req, res) => {
    try {
      // For simplicity, return empty or current model if loaded
      res.json({
        models: [],
      });
    } catch (error) {
      console.error('PS error:', error);
      res.status(500).json(createErrorResponse(error.message));
    }
  });

  /**
   * POST /api/pull - Pull/download a model (mock implementation)
   */
  router.post('/api/pull', async (req, res) => {
    const { model, stream = true } = req.body;

    if (!model) {
      return res.status(400).json(createErrorResponse('Model name is required'));
    }

    // Mock implementation - just return success
    if (stream) {
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.write(JSON.stringify({ status: 'pulling manifest' }) + '\n');
      res.write(JSON.stringify({ status: 'success' }) + '\n');
      res.end();
    } else {
      res.json({ status: 'success' });
    }
  });

  /**
   * DELETE /api/delete - Delete a model (mock implementation)
   */
  router.delete('/api/delete', async (req, res) => {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json(createErrorResponse('Model name is required'));
    }

    // Mock implementation
    res.json({ status: 'success' });
  });

  /**
   * Health check endpoint
   */
  router.get('/api/health', (req, res) => {
    const isConnected = hailoClient.isConnected();
    res.json({
      status: isConnected ? 'ok' : 'disconnected',
      python_service: isConnected ? 'connected' : 'disconnected',
    });
  });

  return router;
}

module.exports = createRoutes;
