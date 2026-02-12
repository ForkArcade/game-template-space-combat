# Space Combat — ForkArcade

Real-time kosmiczna walka z modularnymi statkami, fizyka lotu i per-part damage.

## Struktura plikow

| Plik | Opis |
|------|------|
| `data.js` | Rejestracja danych: `FA.register('partTypes', ...)`, `FA.register('shipLayouts', ...)`, config, dzwieki, narracja |
| `physics.js` | Fizyka: wektory, ciag, masa, torque, kolizje, connectivity BFS. Eksport: `window.Physics` |
| `ship.js` | Logika: tworzenie statkow, damage, detach, AI, ekrany. Eksport: `window.Ship` |
| `render.js` | Warstwy renderowania: grid, statki, pociski, indicators, HUD, narracja. Eksport: `window.Render` |
| `main.js` | Entry point: keybindings, game loop (real-time), `ForkArcade.onReady/submitScore` |

Pliki z szablonu (nie edytuj):
- `fa-engine.js`, `fa-renderer.js`, `fa-input.js`, `fa-audio.js` — engine

Pliki kopiowane przez platforme (nie edytuj):
- `forkarcade-sdk.js` — SDK (scoring, auth)
- `fa-narrative.js` — modul narracji (graf, zmienne, transition)
- `sprites.js` — generowany z `_sprites.json`

## Engine API (window.FA)

- **Event bus**: `FA.on(event, fn)`, `FA.emit(event, data)`, `FA.off(event, fn)`
- **State**: `FA.resetState(obj)`, `FA.getState()`, `FA.setState(key, val)`
- **Registry**: `FA.register(registry, id, def)`, `FA.lookup(registry, id)`, `FA.lookupAll(registry)`
- **Game loop**: `FA.setUpdate(fn)`, `FA.setRender(fn)`, `FA.start()`, `FA.stop()` — **UWAGA: `dt` jest w milisekundach** (~16.67ms per tick)
- **Canvas**: `FA.initCanvas(id, w, h)`, `FA.getCtx()`, `FA.getCanvas()`
- **Layers**: `FA.addLayer(name, drawFn, order)`, `FA.renderLayers()`
- **Draw**: `FA.draw.clear/rect/strokeRect/text/bar/circle/strokeCircle/sprite/withAlpha/withClip`
- **Input**: `FA.bindKey(action, keys)`, `FA.isAction(action)`, `FA.isHeld(action)`, `FA.consumeClick()`, `FA.getMouse()`, `FA.clearInput()`
- **Audio**: `FA.defineSound(name, fn)`, `FA.playSound(name)` — built-in: hit, pickup, death, step, spell, levelup
- **Effects**: `FA.addFloat(x, y, text, color, dur)`, `FA.addEffect(obj)`, `FA.updateEffects(dt)`, `FA.updateFloats(dt)`, `FA.drawFloats()`
- **Camera**: `FA.camera.x`, `FA.camera.y`, `FA.camera.follow(tx,ty,mw,mh,vw,vh)`, `FA.camera.reset()`
- **Narrative**: `FA.narrative.init(cfg)`, `.transition(nodeId, event)`, `.setVar(name, val, reason)`, `.getVar(name)`, `.getNode()`
- **Utils**: `FA.rand(min,max)`, `FA.clamp(val,min,max)`, `FA.pick(arr)`, `FA.shuffle(arr)`, `FA.uid()`

## Physics API (window.Physics)

| Metoda | Opis |
|--------|------|
| `getMass(parts)` | Zwraca `{ mass, cx, cy }` — calkowita masa i srodek masy |
| `applyThrust(ship, part, force)` | Aplikuje ciag z silnika + torque |
| `applyTurn(ship, 'left'\|'right', power)` | Obraca uzywajac silnikow po odpowiedniej stronie |
| `updatePhysics(obj)` | Aktualizuje pozycje, predkosc, tarcie |
| `isConnected(parts, index)` | BFS: czy czesc jest polaczona z core |
| `worldPartPosition(ship, part)` | Pozycja czesci w koordynatach swiata |
| `checkBulletHit(bullet, ship)` | Zwraca `{ partIndex }` lub `null` |
| `snapToGrid(x, y)` | Zaokragla do siatki 30px |
| `worldToLocal(wx, wy, ship)` | Swiat -> lokalne statku |
| `localToWorld(lx, ly, ship)` | Lokalne -> swiat |

## Ship API (window.Ship)

| Metoda | Opis |
|--------|------|
| `create(layoutId, x, y)` | Tworzy instancje statku z layoutu |
| `damagePart(ship, partIndex, state)` | Zadaje 1 dmg czesci, odczepia gdy HP=0 |
| `detach(ship, partIndex, state)` | Odczepia czesc — staje sie floatingPart |
| `updateFloatingParts(state)` | Ruch, lifetime, auto-pickup dryfujacych czesci |
| `spawnEnemy(state)` | Nowy wrog w odleglosci 500px od gracza |
| `updateEnemyAI(enemy, playerShip, state)` | AI: obroc, lec, strzelaj |
| `playerShoot(state)` | Strzal ze wszystkich podlaczonych dzial gracza |
| `updateBullets(state)` | Ruch pociskow, kolizje, usuwanie |
| `startScreen()` | Resetuje state, ekran startowy |
| `beginGame()` | Tworzy statek gracza, spawnuje wrogow |
| `gameOver(state)` | Oblicza score, emituje `game:over` |
| `showNarrative(nodeId)` | Wyswietla tekst narracyjny z fadeout |

## Eventy

| Event | Opis |
|-------|------|
| `input:action` | Klawisz zbindowany do akcji |
| `entity:damaged` | Czesc statku trafiona (auto: `FA.playSound('hit')`) |
| `entity:killed` | Statek stracil wszystkie core (auto: `FA.playSound('death')`) |
| `game:over` | Koniec gry (victory/score) |
| `state:changed` | Zmiana stanu |
| `narrative:transition` | Przejscie w grafie narracji |

## Scoring

```
score = (kills * 100) + (parts_collected * 25) + (damage_dealt * 2) + floor(survival_seconds)
```

`ForkArcade.submitScore(score)` w obsludze `game:over`.

## Sprite fallback

`FA.draw.sprite(category, name, x, y, size, fallbackChar, fallbackColor)` — jesli brak sprite'a, rysuje tekst.

## Uklad koordynat

- Kat 0 = gora (przod statku)
- Kat rosnie zgodnie z ruchem wskazowek zegara
- `Math.sin(angle)` = skladowa X, `-Math.cos(angle)` = skladowa Y
- Czesci statku w koordynatach lokalnych: (0,0) = srodek, -Y = przod
