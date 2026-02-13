# Space Combat — Game Design Prompt

You are creating a Space Combat game for the ForkArcade platform. The game uses a multi-file architecture with the FA engine. It's a real-time game with modular ships, flight physics and per-part damage.

## File architecture

```
forkarcade-sdk.js   — PLATFORM: SDK (scoring, auth) (do not modify)
fa-narrative.js     — PLATFORM: narrative module (do not modify)
sprites.js          — generated from _sprites.json (do not modify manually)
fa-engine.js        — ENGINE (from template): game loop, event bus, state, registry (do not modify)
fa-renderer.js      — ENGINE (from template): canvas, layers, draw helpers (do not modify)
fa-input.js         — ENGINE (from template): keyboard/mouse, keybindings (do not modify)
fa-audio.js         — ENGINE (from template): Web Audio, sounds (do not modify)
data.js             — GAME DATA: config, part types, ship layouts, sounds, narrative
physics.js          — PHYSICS: vectors, thrust, mass, collisions, connectivity BFS
ship.js             — LOGIC: ship creation, damage, detach, AI, screens
render.js           — RENDERING: grid, ships, bullets, HUD, narrative
main.js             — ENTRY POINT: keybindings, game loop, ForkArcade integration
```

**You only modify: `data.js`, `physics.js`, `ship.js`, `render.js`, `main.js`.**

## Key mechanics

### Modular ship
- Ship = set of parts on a 30px grid
- Types: core (8 HP), engine (3 HP), gun (2 HP), cargo (2 HP)
- A part is "connected" = there exists a BFS path through adjacent parts to core (distance < 40px)
- Disconnected parts: don't function, alpha 0.4, get detached

### Flight physics
- Real-time: `FA.isHeld()` instead of `FA.isAction()`
- Thrust: each engine applies force in the ship's forward direction
- Torque: engine off center of mass generates rotation
- Friction: `vel *= 0.98`, `angVel *= 0.9` per tick
- Turbo: Shift = 1.8x thrust multiplier
- Coordinate system: 0 = up (ship front = -Y in local coords)

### Per-part damage
- Bullets hit a specific part (radius 20px)
- Part loses HP -> `entity:damaged` event + float "-1"
- HP <= 0 = part detaches and drifts as floatingPart
- No core = ship destroyed

### Part collection
- Detached parts drift with velocity and spin
- Proximity auto-pickup (radius 40px)
- Part attaches to the nearest free grid slot
- Drifting part lifetime: 900 ticks (~15 seconds)

### Enemy AI
- Simple targeting: calculate angle to player, rotate, fly, shoot
- `atan2(dx, -dy)` for angle (0 = up)
- Shoot when aimed (< 0.3 rad) and close (< 400px)
- Enemy cooldown 3x longer than player's

### Camera
- Ship-centric: `FA.camera.x = ship.x - canvasW/2`
- Infinite space (no clamping)
- Background grid scrolls with parallax

## Scoring
```
score = (kills * 100) + (parts_collected * 25) + (damage_dealt * 2) + floor(survival_seconds)
```

## Adding content (data.js)

### New part type
```js
FA.register('partTypes', 'shield', { name: 'Shield', mass: 8, maxHp: 5, char: 'S' });
```

### New ship layout
```js
FA.register('shipLayouts', 'enemy_sniper', {
  parts: [
    { x: 0, y: 0, type: 'core' },
    { x: 0, y: 30, type: 'engine' },
    { x: 0, y: -30, type: 'gun' },
    { x: 0, y: -60, type: 'gun' }
  ]
});
```

### New sound
```js
FA.defineSound('shield_hit', function(actx, dest) {
  var osc = actx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1000, actx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(500, actx.currentTime + 0.1);
  osc.connect(dest);
  osc.start();
  osc.stop(actx.currentTime + 0.1);
});
```

### New narrative node
```js
FA.register('narrativeText', 'boss_encounter', {
  text: 'Massive mothership detected!',
  color: '#f4f'
});
```

## Event bus — key events

| Event | Payload | When |
|-------|---------|------|
| `input:action` | `{ action, key }` | Key pressed |
| `entity:damaged` | `{ entity, part, partIndex }` | Ship part hit |
| `entity:killed` | `{ entity }` | Ship lost all cores |
| `game:over` | `{ victory, score }` | Game ended |
| `state:changed` | `{ key, value, prev }` | State changed |
| `narrative:transition` | `{ from, to, event }` | Narrative node changed |

## Rendering (render.js)

Use the layer system with FA.camera offset:
```js
FA.addLayer('myLayer', function() {
  var state = FA.getState();
  // Convert to screen: screenX = worldX - FA.camera.x
  var sx = obj.x - FA.camera.x;
  var sy = obj.y - FA.camera.y;
  FA.draw.circle(sx, sy, 5, '#0ff');
}, 12);
```

Ship rotation:
```js
ctx.save();
ctx.translate(screenX, screenY);
ctx.rotate(ship.angle);
// Draw parts in local coordinates (part.x, part.y)
ctx.restore();
```

## Physics (physics.js)

API:
- `Physics.getMass(parts)` -> `{ mass, cx, cy }`
- `Physics.applyThrust(ship, part, force)` — thrust + torque
- `Physics.applyTurn(ship, 'left'|'right', power)` — rotate using engines
- `Physics.updatePhysics(obj)` — position, velocity, friction
- `Physics.isConnected(parts, index)` — BFS from core
- `Physics.worldPartPosition(ship, part)` -> `{ x, y }`
- `Physics.checkBulletHit(bullet, ship)` -> `{ partIndex }` or `null`

## Narrative

Use `FA.narrative` and `showNarrative()`:
```js
Ship.showNarrative('first_kill'); // displays text + transition
FA.narrative.setVar('kills', 5, 'Fifth kill');
```

## Sprites

Use `create_sprite` and `get_asset_guide` from MCP tools. Integration:
```js
FA.draw.sprite('player', 'core', x - 10, y - 10, 20, 'O', '#f44');
```
Last 2 arguments = fallback char and color when sprite is missing.

## What to avoid
- Turn-based movement (the game is real-time!)
- Complex crafting/inventory
- Modifying ENGINE files (fa-*.js)
- Animations blocking the game loop
