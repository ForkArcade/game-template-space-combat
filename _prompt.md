# Space Combat — Game Design Prompt

Tworzysz gre typu Space Combat na platforme ForkArcade. Gra uzywa multi-file architektury z silnikiem FA. To gra real-time z modularnymi statkami, fizyka lotu i per-part damage.

## Architektura plikow

```
forkarcade-sdk.js   — PLATFORMA: SDK (scoring, auth) (nie modyfikuj)
fa-narrative.js     — PLATFORMA: modul narracji (nie modyfikuj)
sprites.js          — generowany z _sprites.json (nie modyfikuj recznie)
fa-engine.js        — ENGINE (z szablonu): game loop, event bus, state, registry (nie modyfikuj)
fa-renderer.js      — ENGINE (z szablonu): canvas, layers, draw helpers (nie modyfikuj)
fa-input.js         — ENGINE (z szablonu): keyboard/mouse, keybindings (nie modyfikuj)
fa-audio.js         — ENGINE (z szablonu): Web Audio, dzwieki (nie modyfikuj)
data.js             — DANE GRY: config, typy czesci, uklady statkow, dzwieki, narracja
physics.js          — FIZYKA: wektory, ciag, masa, kolizje, connectivity BFS
ship.js             — LOGIKA: tworzenie statkow, damage, detach, AI, ekrany
render.js           — RENDERING: grid, statki, pociski, HUD, narracja
main.js             — ENTRY POINT: keybindings, game loop, ForkArcade integration
```

**Modyfikujesz tylko: `data.js`, `physics.js`, `ship.js`, `render.js`, `main.js`.**

## Kluczowe mechaniki

### Modularny statek
- Statek = zestaw czesci na siatce 30px
- Typy: core (rdzen, 8 HP), engine (silnik, 3 HP), gun (dzialo, 2 HP), cargo (ladownia, 2 HP)
- Czesc jest "podlaczona" = istnieje sciezka BFS przez sasiednie czesci do core (odleglosc < 40px)
- Niepolaczone czesci: nie dzialaja, alpha 0.4, sa odczepiane

### Fizyka lotu
- Real-time: `FA.isHeld()` zamiast `FA.isAction()`
- Ciag: kazdy silnik aplikuje sile w kierunku przodu statku
- Torque: silnik poza srodkiem masy generuje obrot
- Tarcie: `vel *= 0.98`, `angVel *= 0.9` per tick
- Turbo: Shift = 1.8x mnoznik ciagu
- Uklad koordynat: 0 = gora (przod statku = -Y w lokalnych)

### Per-part damage
- Pociski trafiaja w konkretna czesc (radius 20px)
- Czesc traci HP -> `entity:damaged` event + float "-1"
- HP <= 0 = czesc odczepia sie i dryfuje jako floatingPart
- Brak core = zniszczenie statku

### Zbieranie czesci
- Odczepione czesci dryfuja z predkoscia i spinem
- Proximity auto-pickup (radius 40px)
- Czesc doczepia sie do najblizszego wolnego slotu na siatce
- Zycie dryfujacej czesci: 900 tickow (~15 sekund)

### AI wrogow
- Prosty targeting: oblicz kat do gracza, obroc sie, lec, strzelaj
- `atan2(dx, -dy)` dla katu (0 = gora)
- Strzelaj gdy wycelowany (< 0.3 rad) i blisko (< 400px)
- Enemy cooldown 3x dluzszy niz gracza

### Kamera
- Ship-centric: `FA.camera.x = ship.x - canvasW/2`
- Nieskonczona przestrzen (bez clampowania)
- Grid tla przewija sie z paralaksa

## Scoring
```
score = (kills * 100) + (parts_collected * 25) + (damage_dealt * 2) + floor(survival_seconds)
```

## Jak dodawac zawartosc (data.js)

### Nowy typ czesci
```js
FA.register('partTypes', 'shield', { name: 'Tarcza', mass: 8, maxHp: 5, char: 'S' });
```

### Nowy uklad statku
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

### Nowy dzwiek
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

### Nowy wezel narracji
```js
FA.register('narrativeText', 'boss_encounter', {
  text: 'Ogromny statek matka wykryty!',
  color: '#f4f'
});
```

## Event bus — kluczowe eventy

| Event | Payload | Kiedy |
|-------|---------|-------|
| `input:action` | `{ action, key }` | Klawisz nacisniety |
| `entity:damaged` | `{ entity, part, partIndex }` | Czesc statku trafiona |
| `entity:killed` | `{ entity }` | Statek stracil wszystkie core |
| `game:over` | `{ victory, score }` | Koniec gry |
| `state:changed` | `{ key, value, prev }` | Zmiana stanu |
| `narrative:transition` | `{ from, to, event }` | Zmiana wezla narracji |

## Rendering (render.js)

Uzywaj layer system z FA.camera offset:
```js
FA.addLayer('myLayer', function() {
  var state = FA.getState();
  // Przelicz na ekran: screenX = worldX - FA.camera.x
  var sx = obj.x - FA.camera.x;
  var sy = obj.y - FA.camera.y;
  FA.draw.circle(sx, sy, 5, '#0ff');
}, 12);
```

Rotacja statku:
```js
ctx.save();
ctx.translate(screenX, screenY);
ctx.rotate(ship.angle);
// Rysuj czesci w koordynatach lokalnych (part.x, part.y)
ctx.restore();
```

## Physics (physics.js)

API:
- `Physics.getMass(parts)` -> `{ mass, cx, cy }`
- `Physics.applyThrust(ship, part, force)` — ciag + torque
- `Physics.applyTurn(ship, 'left'|'right', power)` — obroc uzywajac silnikow
- `Physics.updatePhysics(obj)` — pozycja, predkosc, tarcie
- `Physics.isConnected(parts, index)` — BFS od core
- `Physics.worldPartPosition(ship, part)` -> `{ x, y }`
- `Physics.checkBulletHit(bullet, ship)` -> `{ partIndex }` lub `null`

## Narrative

Uzywaj `FA.narrative` i `showNarrative()`:
```js
Ship.showNarrative('first_kill'); // wyswietla tekst + transition
FA.narrative.setVar('kills', 5, 'Piaty fraг');
```

## Sprite'y

Uzyj `create_sprite` i `get_asset_guide` z MCP tools. Integracja:
```js
FA.draw.sprite('player', 'core', x - 10, y - 10, 20, 'O', '#f44');
```
Ostatnie 2 argumenty = fallback char i kolor gdy brak sprite'a.

## Czego unikac
- Turowy ruch (gra jest real-time!)
- Skomplikowany crafting/inventory
- Modyfikowanie plikow ENGINE (fa-*.js)
- Animacje blokujace game loop
