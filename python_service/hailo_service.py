#!/usr/bin/env python3
"""
Hailo Platform Service for Ollama API compatibility
WebSocket server that wraps hailo-platform LLM functionality
"""

import asyncio
import json
import logging
import sys
import time
from typing import Dict, List, Optional, Any
import websockets
from pathlib import Path

try:
    from hailo_platform import VDevice
    from hailo_platform.genai import LLM
    HAILO_AVAILABLE = True
except ImportError:
    HAILO_AVAILABLE = False
    print("Warning: hailo-platform not available, running in mock mode")


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HailoService:
    """Service wrapper for hailo-platform LLM operations"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.vdevice: Optional[VDevice] = None
        self.llm: Optional[LLM] = None
        self.current_model: Optional[str] = None
        self.models_config = config.get('hailo', {}).get('models', {})
        
        if HAILO_AVAILABLE:
            try:
                logger.info("Initializing VDevice...")
                self.vdevice = VDevice()
                logger.info("VDevice initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize VDevice: {e}")
                self.vdevice = None
    
    def load_model(self, model_name: str) -> bool:
        """Load a specific model by name"""
        if not HAILO_AVAILABLE or self.vdevice is None:
            logger.warning("Hailo platform not available or VDevice not initialized")
            return False
        
        # If model is already loaded, skip
        if self.current_model == model_name and self.llm is not None:
            logger.info(f"Model {model_name} already loaded")
            return True
        
        # Get model config
        model_config = self.models_config.get(model_name)
        if not model_config:
            logger.error(f"Model {model_name} not found in configuration")
            return False
        
        hef_path = model_config.get('hef_path')
        if not hef_path or not Path(hef_path).exists():
            logger.error(f"HEF file not found: {hef_path}")
            return False
        
        try:
            # Release existing LLM if loaded
            if self.llm is not None:
                logger.info(f"Releasing previous model: {self.current_model}")
                self.llm.release()
                self.llm = None
            
            # Load new model
            logger.info(f"Loading model {model_name} from {hef_path}")
            self.llm = LLM(vdevice=self.vdevice, hef_path=hef_path)
            self.current_model = model_name
            logger.info(f"Model {model_name} loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return False
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.8,
        max_tokens: int = 2048,
        seed: Optional[int] = None,
        stream: bool = True
    ):
        """Generate chat completion"""
        
        # Mock mode for testing without hardware
        if not HAILO_AVAILABLE or self.llm is None:
            logger.info("Running in mock mode")
            mock_response = "This is a mock response. Hailo platform is not available or model not loaded."
            
            if stream:
                # Simulate token streaming
                for word in mock_response.split():
                    yield {
                        'type': 'token',
                        'content': word + ' ',
                        'done': False
                    }
                    await asyncio.sleep(0.05)
            else:
                yield {
                    'type': 'complete',
                    'content': mock_response,
                    'done': True
                }
            return
        
        # Load model if needed
        if not self.load_model(model):
            yield {
                'type': 'error',
                'content': f'Failed to load model: {model}'
            }
            return
        
        try:
            # Generate with streaming
            start_time = time.time()
            full_response = ""
            token_count = 0
            
            gen_kwargs = {
                'prompt': messages,
                'temperature': temperature,
                'max_generated_tokens': max_tokens
            }
            if seed is not None:
                gen_kwargs['seed'] = seed
            
            with self.llm.generate(**gen_kwargs) as gen:
                for token in gen:
                    token_count += 1
                    full_response += token
                    
                    if stream:
                        yield {
                            'type': 'token',
                            'content': token,
                            'done': False
                        }
            
            # Send final message with stats
            elapsed_time = time.time() - start_time
            
            yield {
                'type': 'complete',
                'content': full_response if not stream else '',
                'done': True,
                'eval_count': token_count,
                'eval_duration': int(elapsed_time * 1e9),  # Convert to nanoseconds
                'total_duration': int(elapsed_time * 1e9)
            }
            
        except Exception as e:
            logger.error(f"Error during generation: {e}")
            yield {
                'type': 'error',
                'content': str(e)
            }
    
    async def text_completion(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.8,
        max_tokens: int = 2048,
        seed: Optional[int] = None,
        stream: bool = True
    ):
        """Generate text completion (convert to chat format)"""
        messages = [{"role": "user", "content": prompt}]
        async for chunk in self.chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            seed=seed,
            stream=stream
        ):
            yield chunk
    
    def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model"""
        model_config = self.models_config.get(model_name)
        if not model_config:
            return None
        
        return {
            'name': model_name,
            'family': model_config.get('family', 'unknown'),
            'parameter_size': model_config.get('parameter_size', 'unknown'),
            'format': model_config.get('format', 'hef'),
            'hef_path': model_config.get('hef_path')
        }
    
    def list_models(self) -> List[Dict[str, Any]]:
        """List all available models"""
        models = []
        for model_name, model_config in self.models_config.items():
            hef_path = model_config.get('hef_path', '')
            size = 0
            if Path(hef_path).exists():
                size = Path(hef_path).stat().st_size
            
            models.append({
                'name': model_name,
                'size': size,
                'family': model_config.get('family', 'unknown'),
                'parameter_size': model_config.get('parameter_size', 'unknown'),
                'format': model_config.get('format', 'hef')
            })
        return models
    
    def get_context_usage(self) -> int:
        """Get current context token usage"""
        if self.llm is not None and HAILO_AVAILABLE:
            try:
                return self.llm.get_context_usage_size()
            except:
                return 0
        return 0
    
    def release(self):
        """Release resources"""
        if self.llm is not None:
            logger.info("Releasing LLM resources")
            self.llm.release()
            self.llm = None
        
        if self.vdevice is not None:
            logger.info("Releasing VDevice resources")
            self.vdevice.release()
            self.vdevice = None


class WebSocketServer:
    """WebSocket server to handle requests from Express"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.hailo_service = HailoService(config)
        self.host = config.get('python_service', {}).get('host', '127.0.0.1')
        self.port = config.get('python_service', {}).get('ws_port', 8765)
    
    async def handle_request(self, websocket, path):
        """Handle incoming WebSocket connection and requests"""
        logger.info(f"New WebSocket connection from {websocket.remote_address}")
        
        try:
            async for message in websocket:
                try:
                    request = json.loads(message)
                    action = request.get('action')
                    
                    logger.info(f"Received action: {action}")
                    
                    if action == 'chat':
                        await self.handle_chat(websocket, request)
                    elif action == 'generate':
                        await self.handle_generate(websocket, request)
                    elif action == 'list_models':
                        await self.handle_list_models(websocket)
                    elif action == 'model_info':
                        await self.handle_model_info(websocket, request)
                    elif action == 'context_usage':
                        await self.handle_context_usage(websocket)
                    else:
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'content': f'Unknown action: {action}'
                        }))
                
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON: {e}")
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'content': 'Invalid JSON request'
                    }))
                except Exception as e:
                    logger.error(f"Error handling request: {e}")
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'content': str(e)
                    }))
        
        except websockets.exceptions.ConnectionClosed:
            logger.info("WebSocket connection closed")
    
    async def handle_chat(self, websocket, request: Dict[str, Any]):
        """Handle chat completion request"""
        messages = request.get('messages', [])
        model = request.get('model', self.config.get('hailo', {}).get('default_model', 'llama3.2'))
        temperature = request.get('temperature', 0.8)
        max_tokens = request.get('max_tokens', 2048)
        seed = request.get('seed')
        stream = request.get('stream', True)
        
        async for chunk in self.hailo_service.chat_completion(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            seed=seed,
            stream=stream
        ):
            await websocket.send(json.dumps(chunk))
    
    async def handle_generate(self, websocket, request: Dict[str, Any]):
        """Handle text generation request"""
        prompt = request.get('prompt', '')
        model = request.get('model', self.config.get('hailo', {}).get('default_model', 'llama3.2'))
        temperature = request.get('temperature', 0.8)
        max_tokens = request.get('max_tokens', 2048)
        seed = request.get('seed')
        stream = request.get('stream', True)
        
        async for chunk in self.hailo_service.text_completion(
            prompt=prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            seed=seed,
            stream=stream
        ):
            await websocket.send(json.dumps(chunk))
    
    async def handle_list_models(self, websocket):
        """Handle list models request"""
        models = self.hailo_service.list_models()
        await websocket.send(json.dumps({
            'type': 'models',
            'data': models
        }))
    
    async def handle_model_info(self, websocket, request: Dict[str, Any]):
        """Handle model info request"""
        model_name = request.get('model')
        info = self.hailo_service.get_model_info(model_name)
        
        if info:
            await websocket.send(json.dumps({
                'type': 'model_info',
                'data': info
            }))
        else:
            await websocket.send(json.dumps({
                'type': 'error',
                'content': f'Model not found: {model_name}'
            }))
    
    async def handle_context_usage(self, websocket):
        """Handle context usage request"""
        usage = self.hailo_service.get_context_usage()
        await websocket.send(json.dumps({
            'type': 'context_usage',
            'usage': usage
        }))
    
    async def start(self):
        """Start the WebSocket server"""
        logger.info(f"Starting WebSocket server on ws://{self.host}:{self.port}")
        
        async with websockets.serve(self.handle_request, self.host, self.port):
            logger.info("WebSocket server is running")
            await asyncio.Future()  # Run forever
    
    def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up resources")
        self.hailo_service.release()


async def main():
    """Main entry point"""
    # Load configuration
    config_path = Path(__file__).parent.parent / 'config.json'
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        sys.exit(1)
    
    # Create and start server
    server = WebSocketServer(config)
    
    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("Received interrupt signal")
    finally:
        server.cleanup()
        logger.info("Server stopped")


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down...")
