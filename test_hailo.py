#!/usr/bin/env python3
"""
Standalone test for hailo-platform without the server
"""
try:
    from hailo_platform import VDevice
    from hailo_platform.genai import LLM
    print("✓ hailo-platform module imported successfully")
    
    print("\nTesting VDevice initialization...")
    vdevice = VDevice()
    print("✓ VDevice initialized")
    
    print("\nVDevice info:")
    print(f"  Type: {type(vdevice)}")
    
    print("\n✓ All hailo-platform tests passed!")
    print("\nNote: To test LLM, you need a .hef model file:")
    print("  llm = LLM(vdevice=vdevice, hef_path='model.hef')")
    
    vdevice.release()
    print("\n✓ Resources released")
    
except ImportError as e:
    print("✗ Failed to import hailo-platform")
    print(f"  Error: {e}")
    print("\nInstallation instructions:")
    print("  pip install hailo-platform")
    
except Exception as e:
    print(f"✗ Error during test: {e}")
    print("\nMake sure:")
    print("  1. Hailo drivers are installed")
    print("  2. Hailo hardware is connected")
    print("  3. User has proper permissions")
