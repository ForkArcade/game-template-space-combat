# Space Combat — ForkArcade

Real-time space combat with modular ships, flight physics and per-part damage.

## File structure

| File | Description |
|------|-------------|
| `data.js` | Data registration: `FA.register('partTypes', ...)`, `FA.register('shipLayouts', ...)`, config, sounds, narrative |
| `physics.js` | Physics: vectors, thrust, mass, torque, collisions, connectivity BFS. Export: `window.Physics` |
| `ship.js` | Logic: ship creation, damage, detach, AI, screens. Export: `window.Ship` |
| `render.js` | Rendering layers: grid, ships, bullets, indicators, HUD, narrative. Export: `window.Render` |
| `main.js` | Entry point: keybindings, game loop (real-time), `ForkArcade.onReady/submitScore` |

Template files (do not edit):
- `fa-engine.js`, `fa-renderer.js`, `fa-input.js`, `fa-audio.js` — engine

Files copied by the platform (do not edit):
- `forkarcade-sdk.js` — SDK (scoring, auth)
- `fa-narrative.js` — narrative module (graph, variables, transition)
- `sprites.js` — generated from `_sprites.json`

## Engine API (window.FA)

- **Event bus**: `FA.on(event, fn)`, `FA.emit(event, data)`, `FA.off(event, fn)`
- **State**: `FA.resetState(obj)`, `FA.getState()`, `FA.setState(key, val)`
- **Registry**: `FA.register(registry, id, def)`, `FA.lookup(registry, id)`, `FA.lookupAll(registry)`
- **Game loop**: `FA.setUpdate(fn)`, `FA.setRender(fn)`, `FA.start()`, `FA.stop()` — **NOTE: `dt` is in milliseconds** (~16.67ms per tick)
- **Canvas**: `FA.initCanvas(id, w, h)`, `FA.getCtx()`, `FA.getCanvas()`
- **Layers**: `FA.addLayer(name, drawFn, order)`, `FA.renderLayers()` — **every gameplay layer MUST start with `if (state.screen !== 'playing') return;`** (start/death screens have no ship; an error in any layer kills the game loop permanently)
- **Draw**: `FA.draw.clear/rect/strokeRect/text/bar/circle/strokeCircle/sprite/pushAlpha/popAlpha/withAlpha/withClip` — **Use `pushAlpha(alpha)`/`popAlpha()` instead of `withAlpha` in loops** (avoids closure allocation per iteration)
- **Input**: `FA.bindKey(action, keys)`, `FA.isAction(action)`, `FA.isHeld(action)`, `FA.consumeClick()`, `FA.getMouse()`, `FA.clearInput()`
- **Audio**: `FA.defineSound(name, fn)`, `FA.playSound(name)` — built-in: hit, pickup, death, step, spell, levelup
- **Effects**: `FA.addFloat(x, y, text, color, dur)`, `FA.addEffect(obj)`, `FA.updateEffects(dt)`, `FA.updateFloats(dt)`, `FA.drawFloats()`
- **Camera**: `FA.camera.x`, `FA.camera.y`, `FA.camera.follow(tx,ty,mw,mh,vw,vh)`, `FA.camera.reset()`
- **Narrative**: `FA.narrative.init(cfg)`, `.transition(nodeId, event)`, `.setVar(name, val, reason)`, `.getVar(name)`, `.getNode()`
- **Utils**: `FA.rand(min,max)`, `FA.clamp(val,min,max)`, `FA.pick(arr)`, `FA.shuffle(arr)`, `FA.uid()`

## Physics API (window.Physics)

| Method | Description |
|--------|-------------|
| `getMass(parts)` | Returns `{ mass, cx, cy }` — total mass and center of mass |
| `applyThrust(ship, part, force)` | Applies thrust from engine + torque |
| `applyTurn(ship, 'left'\|'right', power)` | Rotates using engines on the appropriate side |
| `updatePhysics(obj)` | Updates position, velocity, friction |
| `isConnected(parts, index)` | BFS: is the part connected to core |
| `worldPartPosition(ship, part)` | Part position in world coordinates |
| `checkBulletHit(bullet, ship)` | Returns `{ partIndex }` or `null` |
| `snapToGrid(x, y)` | Snaps to 30px grid |
| `worldToLocal(wx, wy, ship)` | World -> ship local coordinates |
| `localToWorld(lx, ly, ship)` | Local -> world coordinates |

## Ship API (window.Ship)

| Method | Description |
|--------|-------------|
| `create(layoutId, x, y)` | Creates a ship instance from layout |
| `damagePart(ship, partIndex, state)` | Deals 1 dmg to part, detaches when HP=0 |
| `detach(ship, partIndex, state)` | Detaches part — becomes a floatingPart |
| `updateFloatingParts(state)` | Movement, lifetime, auto-pickup of drifting parts |
| `spawnEnemy(state)` | New enemy 500px from player |
| `updateEnemyAI(enemy, playerShip, state)` | AI: rotate, fly, shoot |
| `playerShoot(state)` | Fire from all connected player guns |
| `updateBullets(state)` | Bullet movement, collisions, removal |
| `startScreen()` | Resets state, start screen |
| `beginGame()` | Creates player ship, spawns enemies |
| `gameOver(state)` | Calculates score, emits `game:over` |
| `showNarrative(nodeId)` | Displays narrative text with fadeout |

## Events

| Event | Description |
|-------|-------------|
| `input:action` | Key bound to action |
| `entity:damaged` | Ship part hit (auto: `FA.playSound('hit')`) |
| `entity:killed` | Ship lost all cores (auto: `FA.playSound('death')`) |
| `game:over` | Game ended (victory/score) |
| `state:changed` | State changed |
| `narrative:transition` | Narrative graph transition |

## Scoring

```
score = (kills * 100) + (parts_collected * 25) + (damage_dealt * 2) + floor(survival_seconds)
```

`ForkArcade.submitScore(score)` in the `game:over` handler.

## Sprite fallback

`FA.draw.sprite(category, name, x, y, size, fallbackChar, fallbackColor, frame)` — renders sprite frame, or fallback text when no sprite exists. Frame index selects variant.

## Coordinate system

- Angle 0 = up (front of ship)
- Angle increases clockwise
- `Math.sin(angle)` = X component, `-Math.cos(angle)` = Y component
- Ship parts in local coordinates: (0,0) = center, -Y = front
