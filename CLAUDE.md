# SLTD - Tower Defense Game

## Project Overview
A browser-based tower defense game built with vanilla JavaScript and WebGL.

## Project Structure
- `/srv/` - Main application directory
  - `index.html` - Entry point
  - `main.js` - Game loop and core logic
  - `entities.js` - Game entities (towers, enemies, projectiles)
  - `world.js` - Game world and level management
  - `input.js` - User input handling
  - `ui.js` - User interface elements
  - `CanvasGlow.js` - Glow effect shader (optimized)
  - `WebGLBoilerPlate.js` - WebGL setup utilities
  - `Assets.js` - Asset loading and management
  - `littleAStar.js` - Pathfinding algorithm
  - `gadgets.js` - Game gadgets/abilities
  - `/images/` - Game sprites and assets

## Tech Stack
- Vanilla JavaScript (ES5/ES6)
- WebGL for rendering and effects
- HTML5 Canvas
- No build process or dependencies

## Running the Game

### Development Server
```bash
cd srv
python3 -m http.server 8000
```
Then visit: http://localhost:8000

### Alternative (Node.js)
```bash
npx http-server srv -p 8000
```

## Testing the Game
1. Open in browser
2. Check browser console for errors (F12)
3. Test tower placement and enemy spawning
4. Verify glow effects are working
5. Test on different browsers (Chrome, Firefox, Safari)

## Code Style
- Use camelCase for variables and functions
- Modular JavaScript files by functionality
- WebGL shaders in CanvasGlow.js
- Game state managed in main.js

## Recent Improvements
- Glow shader optimized for 4x performance improvement
- Enhanced glow quality and configurability

## Before Committing
- Test game runs without errors
- Check glow effects render correctly
- Verify no console errors in browser
- Test on at least Chrome and Firefox
