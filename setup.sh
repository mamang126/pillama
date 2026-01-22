#!/bin/bash
# Setup script for Pillama

set -e

echo "=========================================="
echo "Pillama Setup Script"
echo "=========================================="
echo ""

# Check Node.js
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not installed"
    echo "Please install Node.js 16+ from https://nodejs.org"
    exit 1
fi
echo "✓ Node.js $(node --version)"

# Check npm
echo "Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "ERROR: npm is not installed"
    exit 1
fi
echo "✓ npm $(npm --version)"

# Check Python
echo "Checking Python..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.8+ from https://python.org"
    exit 1
fi
echo "✓ Python $(python3 --version)"

# Check pip
echo "Checking pip..."
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "ERROR: pip is not installed"
    exit 1
fi
echo "✓ pip installed"

echo ""
echo "Installing Node.js dependencies..."
npm install

echo ""
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo ""
echo "Testing hailo-platform..."
python3 test_hailo.py

echo ""
echo "Creating models directory..."
mkdir -p models

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Place your .hef model files in the models/ directory"
echo "  2. Update config.json with your model paths"
echo "  3. Start the Python service: python python_service/hailo_service.py"
echo "  4. Start the Express server: npm start"
echo "  5. Test the API: python test_api.py"
echo ""
echo "For more information, see README.md"
echo ""
