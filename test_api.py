"""
Example test script for Pillama API
"""
import requests
import json

BASE_URL = "http://localhost:11434"

def test_health():
    """Test health endpoint"""
    print("Testing /api/health...")
    response = requests.get(f"{BASE_URL}/api/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_tags():
    """Test list models endpoint"""
    print("Testing /api/tags...")
    response = requests.get(f"{BASE_URL}/api/tags")
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_show():
    """Test show model endpoint"""
    print("Testing /api/show...")
    response = requests.post(
        f"{BASE_URL}/api/show",
        json={"model": "llama3.2"}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}\n")

def test_generate_streaming():
    """Test generate endpoint with streaming"""
    print("Testing /api/generate (streaming)...")
    response = requests.post(
        f"{BASE_URL}/api/generate",
        json={
            "model": "llama3.2",
            "prompt": "Why is the sky blue?",
            "stream": True
        },
        stream=True
    )
    
    print(f"Status: {response.status_code}")
    print("Streaming response:")
    
    for line in response.iter_lines():
        if line:
            data = json.loads(line)
            if not data.get('done'):
                print(data.get('response', ''), end='', flush=True)
            else:
                print(f"\n\nFinal data: {json.dumps(data, indent=2)}\n")

def test_generate_non_streaming():
    """Test generate endpoint without streaming"""
    print("Testing /api/generate (non-streaming)...")
    response = requests.post(
        f"{BASE_URL}/api/generate",
        json={
            "model": "llama3.2",
            "prompt": "Tell me a joke.",
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 100
            }
        }
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {result.get('response', '')}\n")

def test_chat_streaming():
    """Test chat endpoint with streaming"""
    print("Testing /api/chat (streaming)...")
    response = requests.post(
        f"{BASE_URL}/api/chat",
        json={
            "model": "llama3.2",
            "messages": [
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello! How are you?"}
            ],
            "stream": True
        },
        stream=True
    )
    
    print(f"Status: {response.status_code}")
    print("Streaming response:")
    
    for line in response.iter_lines():
        if line:
            data = json.loads(line)
            if not data.get('done'):
                print(data['message']['content'], end='', flush=True)
            else:
                print(f"\n\nFinal data: {json.dumps(data, indent=2)}\n")

def test_chat_non_streaming():
    """Test chat endpoint without streaming"""
    print("Testing /api/chat (non-streaming)...")
    response = requests.post(
        f"{BASE_URL}/api/chat",
        json={
            "model": "llama3.2",
            "messages": [
                {"role": "user", "content": "What is 2+2?"}
            ],
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 50
            }
        }
    )
    
    print(f"Status: {response.status_code}")
    result = response.json()
    print(f"Response: {result['message']['content']}\n")

def main():
    """Run all tests"""
    print("=" * 60)
    print("Pillama API Test Suite")
    print("=" * 60 + "\n")
    
    try:
        test_health()
        test_tags()
        test_show()
        test_generate_non_streaming()
        test_generate_streaming()
        test_chat_non_streaming()
        test_chat_streaming()
        
        print("=" * 60)
        print("All tests completed!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to server at", BASE_URL)
        print("Make sure the server is running:")
        print("  1. python python_service/hailo_service.py")
        print("  2. npm start")
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    main()
