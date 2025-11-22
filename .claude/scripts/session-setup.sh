#!/bin/bash
set -e

echo "🎮 Setting up SLTD Tower Defense game environment..."

# Detect environment
if [ "$CLAUDE_CODE_REMOTE" = "true" ]; then
  echo "Running in Claude Code Web environment"
  IS_WEB=true
else
  echo "Running in local Claude Code CLI"
  IS_WEB=false
fi

# Set up environment variables
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "Configuring environment..."
  {
    echo 'export GAME_ROOT="./srv"'
    echo 'export DEFAULT_PORT=8000'
  } >> "$CLAUDE_ENV_FILE"
fi

# Check if Python is available for web server
if command -v python3 &> /dev/null; then
  echo "✓ Python3 available for development server"
else
  echo "⚠ Python3 not found - you may need to use another web server"
fi

# Verify game files exist
if [ -f "srv/index.html" ]; then
  echo "✓ Game files found"
  echo "✓ Ready to start development server with: cd srv && python3 -m http.server 8000"
else
  echo "⚠ Warning: Game files not found in srv/"
fi

echo ""
echo "📝 Quick commands:"
echo "  - Run game: cd srv && python3 -m http.server 8000"
echo "  - View in browser: http://localhost:8000"
echo ""
echo "Setup complete! 🚀"
exit 0
