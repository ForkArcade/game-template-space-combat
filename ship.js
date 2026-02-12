// Space Combat — Ship Logic
// Tworzenie statkow, obrazenia, odczepianie, AI wrogow, ekrany
(function() {
  'use strict';
  var FA = window.FA;
  var cfg = FA.lookup('config', 'game');

  function showNarrative(nodeId) {
    var textDef = FA.lookup('narrativeText', nodeId);
    if (textDef) {
      FA.setState('narrativeMessage', { text: textDef.text, color: textDef.color, life: 4000 });
    }
    FA.narrative.transition(nodeId);
  }

  // === TWORZENIE STATKU ===

  function createShip(layoutId, x, y) {
    var layout = FA.lookup('shipLayouts', layoutId);
    if (!layout) return null;
    var parts = [];
    for (var i = 0; i < layout.parts.length; i++) {
      var p = layout.parts[i];
      var def = FA.lookup('partTypes', p.type);
      parts.push({
        x: p.x, y: p.y, type: p.type,
        hp: def ? def.maxHp : 2,
        maxHp: def ? def.maxHp : 2,
        lastHit: 0
      });
    }
    return {
      x: x, y: y, vx: 0, vy: 0,
      angle: 0, angVel: 0,
      parts: parts,
      activeEngines: new Set(),
      lastShot: 0
    };
  }

  // === OBRAZENIA ===

  function damagePart(ship, partIndex, state) {
    var part = ship.parts[partIndex];
    if (!part) return;
    part.hp--;
    part.lastHit = Date.now();
    var wp = Physics.worldPartPosition(ship, part);
    FA.addFloat(wp.x, wp.y, '-1', '#f44', 800);
    FA.emit('entity:damaged', { entity: ship, part: part, partIndex: partIndex });

    if (part.hp <= 0) {
      detachPart(ship, partIndex, state);
      // Sprawdz czy zostaly core
      var hasCores = false;
      for (var i = 0; i < ship.parts.length; i++) {
        if (ship.parts[i].type === 'core') { hasCores = true; break; }
      }
      if (!hasCores) {
        FA.emit('entity:killed', { entity: ship });
      }
    }
  }

  function detachPart(ship, partIndex, state) {
    var part = ship.parts.splice(partIndex, 1)[0];
    var wp = Physics.worldPartPosition(ship, part);
    state.floatingParts.push({
      x: wp.x, y: wp.y,
      vx: ship.vx + (Math.random() - 0.5) * 4,
      vy: ship.vy + (Math.random() - 0.5) * 4,
      type: part.type,
      hp: Math.max(1, part.maxHp),
      maxHp: part.maxHp,
      life: cfg.floatingPartLife,
      spin: (Math.random() - 0.5) * 0.2,
      angle: 0
    });
    FA.playSound('explosion');
  }

  // === DRYFUJACE CZESCI ===

  function updateFloatingParts(state) {
    for (var i = state.floatingParts.length - 1; i >= 0; i--) {
      var fp = state.floatingParts[i];
      fp.x += fp.vx;
      fp.y += fp.vy;
      fp.vx *= 0.99;
      fp.vy *= 0.99;
      fp.angle += fp.spin;
      fp.life--;

      // Auto-pickup przez gracza
      if (state.ship) {
        var d = Math.hypot(fp.x - state.ship.x, fp.y - state.ship.y);
        if (d < cfg.pickupRadius) {
          attachPart(state.ship, fp);
          state.floatingParts.splice(i, 1);
          state.partsCollected++;
          FA.playSound('pickup');
          FA.addFloat(fp.x, fp.y, '+' + fp.type, '#4f4', 800);
          continue;
        }
      }

      if (fp.life <= 0) {
        state.floatingParts.splice(i, 1);
      }
    }
  }

  function attachPart(ship, floatingPart) {
    var local = Physics.worldToLocal(floatingPart.x, floatingPart.y, ship);
    var snapped = Physics.snapToGrid(local.x, local.y);
    // Sprawdz czy slot wolny
    var occupied = false;
    for (var i = 0; i < ship.parts.length; i++) {
      if (ship.parts[i].x === snapped.x && ship.parts[i].y === snapped.y) {
        occupied = true;
        break;
      }
    }
    if (occupied) {
      // Znajdz najblizszy wolny slot
      var offsets = [
        {x: 0, y: -cfg.gridSize}, {x: 0, y: cfg.gridSize},
        {x: -cfg.gridSize, y: 0}, {x: cfg.gridSize, y: 0}
      ];
      for (var j = 0; j < offsets.length; j++) {
        var tx = snapped.x + offsets[j].x, ty = snapped.y + offsets[j].y;
        var free = true;
        for (var k = 0; k < ship.parts.length; k++) {
          if (ship.parts[k].x === tx && ship.parts[k].y === ty) { free = false; break; }
        }
        if (free) { snapped.x = tx; snapped.y = ty; occupied = false; break; }
      }
    }
    if (!occupied) {
      ship.parts.push({
        x: snapped.x, y: snapped.y, type: floatingPart.type,
        hp: floatingPart.hp, maxHp: floatingPart.maxHp, lastHit: 0
      });
    }
  }

  // === SPAWN WROGOW ===

  function spawnEnemy(state) {
    var angle = Math.random() * Math.PI * 2;
    var x = state.ship.x + Math.cos(angle) * cfg.enemySpawnDistance;
    var y = state.ship.y + Math.sin(angle) * cfg.enemySpawnDistance;
    var layouts = ['enemy_fighter', 'enemy_heavy'];
    var layout = FA.pick(layouts);
    var enemy = createShip(layout, x, y);
    if (enemy) {
      enemy.angle = Math.random() * Math.PI * 2;
      state.enemies.push(enemy);
    }
  }

  // === AI WROGOW ===

  function updateEnemyAI(enemy, playerShip, state) {
    if (!playerShip) return;
    var dx = playerShip.x - enemy.x;
    var dy = playerShip.y - enemy.y;
    var dist = Math.hypot(dx, dy);
    var targetAngle = Math.atan2(dx, -dy); // 0 = gora

    // Normalizuj roznice katow
    var angleDiff = targetAngle - enemy.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Obroc w kierunku gracza
    if (angleDiff > 0.1) {
      Physics.applyTurn(enemy, 'right', cfg.thrustBase * 0.5);
    } else if (angleDiff < -0.1) {
      Physics.applyTurn(enemy, 'left', cfg.thrustBase * 0.5);
    }

    // Lec do gracza jesli daleko
    if (dist > 150) {
      var engines = [];
      for (var i = 0; i < enemy.parts.length; i++) {
        if (enemy.parts[i].type === 'engine' && Physics.isConnected(enemy.parts, i)) {
          engines.push(enemy.parts[i]);
        }
      }
      for (var j = 0; j < engines.length; j++) {
        Physics.applyThrust(enemy, engines[j], cfg.thrustBase * 0.3);
      }
    }

    // Strzelaj gdy wycelowany i blisko
    if (Math.abs(angleDiff) < 0.3 && dist < 400) {
      enemyShoot(enemy, state);
    }
  }

  // === STRZALY ===

  function playerShoot(state) {
    var now = Date.now();
    if (now - state.ship.lastShot < cfg.shootCooldown) return;
    state.ship.lastShot = now;

    var fired = false;
    for (var i = 0; i < state.ship.parts.length; i++) {
      var part = state.ship.parts[i];
      if (part.type === 'gun' && Physics.isConnected(state.ship.parts, i)) {
        var wp = Physics.worldPartPosition(state.ship, part);
        state.bullets.push({
          x: wp.x, y: wp.y,
          vx: state.ship.vx + Math.sin(state.ship.angle) * cfg.bulletSpeed,
          vy: state.ship.vy - Math.cos(state.ship.angle) * cfg.bulletSpeed,
          friendly: true,
          life: cfg.bulletLife
        });
        fired = true;
      }
    }
    if (fired) FA.playSound('shoot');
  }

  function enemyShoot(enemy, state) {
    var now = Date.now();
    if (now - enemy.lastShot < cfg.shootCooldown * 3) return;
    enemy.lastShot = now;

    for (var i = 0; i < enemy.parts.length; i++) {
      var part = enemy.parts[i];
      if (part.type === 'gun' && Physics.isConnected(enemy.parts, i)) {
        var wp = Physics.worldPartPosition(enemy, part);
        state.bullets.push({
          x: wp.x, y: wp.y,
          vx: enemy.vx + Math.sin(enemy.angle) * cfg.bulletSpeed * 0.7,
          vy: enemy.vy - Math.cos(enemy.angle) * cfg.bulletSpeed * 0.7,
          friendly: false,
          life: cfg.bulletLife
        });
      }
    }
  }

  // === POCISKI ===

  function updateBullets(state) {
    for (var i = state.bullets.length - 1; i >= 0; i--) {
      var b = state.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;

      if (b.life <= 0) {
        state.bullets.splice(i, 1);
        continue;
      }

      if (b.friendly) {
        // Sprawdz trafienie w wrogow
        for (var j = state.enemies.length - 1; j >= 0; j--) {
          var hit = Physics.checkBulletHit(b, state.enemies[j]);
          if (hit) {
            damagePart(state.enemies[j], hit.partIndex, state);
            state.damageDealt++;
            state.bullets.splice(i, 1);
            // Sprawdz czy wrog zniszczony (brak core)
            var hasCores = false;
            for (var k = 0; k < state.enemies[j].parts.length; k++) {
              if (state.enemies[j].parts[k].type === 'core') { hasCores = true; break; }
            }
            if (!hasCores) {
              state.enemies.splice(j, 1);
              state.kills++;
              FA.narrative.setVar('kills', state.kills, 'Zniszczono wroga');
              if (state.kills === 1) showNarrative('first_kill');
            }
            break;
          }
        }
      } else {
        // Sprawdz trafienie w gracza
        if (state.ship) {
          var playerHit = Physics.checkBulletHit(b, state.ship);
          if (playerHit) {
            damagePart(state.ship, playerHit.partIndex, state);
            state.bullets.splice(i, 1);
            // Sprawdz czy gracz zniszczony
            var playerCores = false;
            for (var m = 0; m < state.ship.parts.length; m++) {
              if (state.ship.parts[m].type === 'core') { playerCores = true; break; }
            }
            if (!playerCores) {
              gameOver(state);
            }
          }
        }
      }
    }
  }

  // === EKRANY ===

  function startScreen() {
    FA.resetState({
      screen: 'start',
      ship: null,
      enemies: [],
      bullets: [],
      floatingParts: [],
      score: 0,
      kills: 0,
      partsCollected: 0,
      damageDealt: 0,
      survivalTime: 0,
      narrativeMessage: null
    });
    var narCfg = FA.lookup('config', 'narrative');
    if (narCfg) FA.narrative.init(narCfg);
  }

  function beginGame() {
    var state = FA.getState();
    state.screen = 'playing';
    state.ship = createShip('player_default', 0, 0);
    spawnEnemy(state);
    spawnEnemy(state);
    showNarrative('launch');
  }

  function gameOver(state) {
    state.screen = 'death';
    var scoring = FA.lookup('config', 'scoring');
    state.score = (state.kills * scoring.killMultiplier) +
                  (state.partsCollected * scoring.partCollectedMultiplier) +
                  (state.damageDealt * scoring.damageMultiplier) +
                  Math.floor(state.survivalTime * scoring.survivalPerSecond);
    FA.emit('game:over', { victory: false, score: state.score });
    showNarrative('destroyed');
  }

  // === EKSPORT ===

  window.Ship = {
    create: createShip,
    damagePart: damagePart,
    detach: detachPart,
    updateFloatingParts: updateFloatingParts,
    spawnEnemy: spawnEnemy,
    updateEnemyAI: updateEnemyAI,
    playerShoot: playerShoot,
    updateBullets: updateBullets,
    startScreen: startScreen,
    beginGame: beginGame,
    gameOver: gameOver,
    showNarrative: showNarrative
  };

})();
