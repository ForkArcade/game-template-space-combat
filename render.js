// Space Combat — Rendering
// Warstwy: start/death screen, grid, floatingParts, ships, bullets, effects, indicators, narrative, HUD
(function() {
  'use strict';
  var FA = window.FA;

  function setupLayers() {
    var cfg = FA.lookup('config', 'game');
    var colors = FA.lookup('config', 'colors');
    var ctx = FA.getCtx();

    // === EKRAN STARTOWY ===
    FA.addLayer('startScreen', function() {
      var state = FA.getState();
      if (state.screen !== 'start') return;
      FA.draw.text('SPACE COMBAT', cfg.canvasWidth / 2, 200, { color: '#0ff', size: 48, bold: true, align: 'center' });
      FA.draw.text('Modularne statki. Fizyka. Zniszczenie.', cfg.canvasWidth / 2, 270, { color: '#888', size: 16, align: 'center' });
      FA.draw.text('WASD — lot | SHIFT — turbo', cfg.canvasWidth / 2, 340, { color: '#aaa', size: 14, align: 'center' });
      FA.draw.text('SPACJA — strzal | Zbieraj dryfujace czesci', cfg.canvasWidth / 2, 370, { color: '#aaa', size: 14, align: 'center' });
      FA.draw.text('[SPACJA] aby rozpoczac', cfg.canvasWidth / 2, 450, { color: '#fff', size: 20, bold: true, align: 'center' });
    }, 0);

    // === EKRAN SMIERCI ===
    FA.addLayer('deathScreen', function() {
      var state = FA.getState();
      if (state.screen !== 'death') return;
      FA.draw.withAlpha(0.7, function() {
        FA.draw.rect(0, 0, cfg.canvasWidth, cfg.canvasHeight, '#000');
      });
      FA.draw.text('ZNISZCZONY', cfg.canvasWidth / 2, 200, { color: '#f44', size: 48, bold: true, align: 'center' });
      FA.draw.text('Wynik: ' + state.score, cfg.canvasWidth / 2, 280, { color: '#fff', size: 24, align: 'center' });
      FA.draw.text('Zabici: ' + state.kills + ' | Czesci: ' + state.partsCollected + ' | Obrazenia: ' + state.damageDealt, cfg.canvasWidth / 2, 330, { color: '#aaa', size: 14, align: 'center' });
      FA.draw.text('Czas: ' + Math.floor(state.survivalTime) + 's', cfg.canvasWidth / 2, 360, { color: '#aaa', size: 14, align: 'center' });
      // Narracja na ekranie smierci
      if (state.narrativeMessage) {
        FA.draw.text(state.narrativeMessage.text, cfg.canvasWidth / 2, 410, { color: state.narrativeMessage.color, size: 16, align: 'center' });
      }
      FA.draw.text('[R] restart', cfg.canvasWidth / 2, 480, { color: '#fff', size: 18, bold: true, align: 'center' });
    }, 0);

    // === SIATKA TLA ===
    FA.addLayer('grid', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      var gridSize = 250;
      var ox = -(FA.camera.x % gridSize);
      var oy = -(FA.camera.y % gridSize);
      ctx.strokeStyle = colors.gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = ox; x < cfg.canvasWidth; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cfg.canvasHeight);
      }
      for (var y = oy; y < cfg.canvasHeight; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(cfg.canvasWidth, y);
      }
      ctx.stroke();
    }, 1);

    // === DRYFUJACE CZESCI ===
    FA.addLayer('floatingParts', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      for (var i = 0; i < state.floatingParts.length; i++) {
        var fp = state.floatingParts[i];
        var sx = fp.x - FA.camera.x;
        var sy = fp.y - FA.camera.y;
        if (sx < -50 || sx > cfg.canvasWidth + 50 || sy < -50 || sy > cfg.canvasHeight + 50) continue;
        var alpha = FA.clamp(fp.life / 200, 0.2, 0.8);
        FA.draw.withAlpha(alpha, function() {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(fp.angle);
          var def = FA.lookup('partTypes', fp.type);
          var ch = def ? def.char : '?';
          FA.draw.sprite('items', 'floating' + fp.type.charAt(0).toUpperCase() + fp.type.slice(1),
            -10, -10, 20, ch, '#888');
          ctx.restore();
        });
      }
    }, 2);

    // === STATKI ===
    FA.addLayer('ships', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      if (state.ship) drawShip(state.ship, true, ctx, cfg, colors);
      for (var i = 0; i < state.enemies.length; i++) {
        drawShip(state.enemies[i], false, ctx, cfg, colors);
      }
    }, 5);

    // === POCISKI ===
    FA.addLayer('bullets', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      for (var i = 0; i < state.bullets.length; i++) {
        var b = state.bullets[i];
        var sx = b.x - FA.camera.x, sy = b.y - FA.camera.y;
        if (sx < -20 || sx > cfg.canvasWidth + 20 || sy < -20 || sy > cfg.canvasHeight + 20) continue;
        var color = b.friendly ? colors.bulletFriendly : colors.bulletEnemy;
        // Linia z glow
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - b.vx * 0.3, sy - b.vy * 0.3);
        ctx.stroke();
        ctx.restore();
      }
    }, 10);

    // === EFEKTY I FLOATY ===
    FA.addLayer('effects', function() {
      FA.drawFloats();
    }, 15);

    // === WSKAZNIKI WROGOW ===
    FA.addLayer('indicators', function() {
      var state = FA.getState();
      if (state.screen !== 'playing' || !state.ship) return;
      var margin = 30;
      for (var i = 0; i < state.enemies.length; i++) {
        var e = state.enemies[i];
        var ex = e.x - FA.camera.x, ey = e.y - FA.camera.y;
        // Tylko jesli poza ekranem
        if (ex >= 0 && ex <= cfg.canvasWidth && ey >= 0 && ey <= cfg.canvasHeight) continue;
        var cx = cfg.canvasWidth / 2, cy = cfg.canvasHeight / 2;
        var angle = Math.atan2(ey - cy, ex - cx);
        var ix = FA.clamp(cx + Math.cos(angle) * 300, margin, cfg.canvasWidth - margin);
        var iy = FA.clamp(cy + Math.sin(angle) * 300, margin, cfg.canvasHeight - margin);
        // Trojkat wskazujacy
        ctx.save();
        ctx.translate(ix, iy);
        ctx.rotate(angle);
        ctx.fillStyle = '#4f4';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -5);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }, 20);

    // === NARRACJA ===
    FA.addLayer('narrative', function() {
      var state = FA.getState();
      if (state.screen !== 'playing') return;
      if (!state.narrativeMessage || state.narrativeMessage.life <= 0) return;
      var alpha = Math.min(1, state.narrativeMessage.life / 1000);
      FA.draw.withAlpha(alpha, function() {
        FA.draw.rect(0, 0, cfg.canvasWidth, 40, 'rgba(0,0,0,0.6)');
        FA.draw.text(state.narrativeMessage.text, cfg.canvasWidth / 2, 12,
          { color: state.narrativeMessage.color, size: 16, align: 'center' });
      });
    }, 25);

    // === HUD ===
    FA.addLayer('hud', function() {
      var state = FA.getState();
      if (state.screen !== 'playing' || !state.ship) return;
      var y = cfg.canvasHeight - 30;
      // Zliczenia
      var engines = 0, guns = 0, coreHp = 0, coreMax = 0;
      for (var i = 0; i < state.ship.parts.length; i++) {
        var p = state.ship.parts[i];
        if (p.type === 'engine' && Physics.isConnected(state.ship.parts, i)) engines++;
        if (p.type === 'gun' && Physics.isConnected(state.ship.parts, i)) guns++;
        if (p.type === 'core') { coreHp += p.hp; coreMax += p.maxHp; }
      }
      var info = 'Silniki: ' + engines + ' | Dziala: ' + guns + ' | Rdzen: ' + coreHp + '/' + coreMax +
                 ' | Wrogowie: ' + state.enemies.length + ' | Wynik: ' + Math.floor(
                   state.kills * FA.lookup('config', 'scoring').killMultiplier +
                   state.partsCollected * FA.lookup('config', 'scoring').partCollectedMultiplier);
      FA.draw.rect(0, y - 5, cfg.canvasWidth, 35, 'rgba(0,0,0,0.5)');
      FA.draw.text(info, 10, y, { color: colors.text, size: 14 });
    }, 30);
  }

  // === RYSOWANIE STATKU ===

  function drawShip(ship, isPlayer, ctx, cfg, colors) {
    var sx = ship.x - FA.camera.x;
    var sy = ship.y - FA.camera.y;
    // Sprawdz czy na ekranie (z marginesem)
    if (sx < -200 || sx > cfg.canvasWidth + 200 || sy < -200 || sy > cfg.canvasHeight + 200) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ship.angle);

    for (var i = 0; i < ship.parts.length; i++) {
      var part = ship.parts[i];
      var conn = Physics.isConnected(ship.parts, i);
      var partAlpha = conn ? 1.0 : 0.4;
      var color = getPartColor(part.type, isPlayer, conn, colors);
      var def = FA.lookup('partTypes', part.type);
      var ch = def ? def.char : '?';

      // Hit flash
      var hitFlash = (Date.now() - part.lastHit) < 100;
      if (hitFlash) color = '#fff';

      FA.draw.withAlpha(partAlpha, function() {
        var category = isPlayer ? 'player' : 'enemies';
        var spriteName = part.type;
        // Aktywny silnik
        if (part.type === 'engine' && ship.activeEngines && ship.activeEngines.has(part)) {
          spriteName = 'engineActive';
          // Plomien silnika
          ctx.save();
          ctx.shadowColor = '#0ff';
          ctx.shadowBlur = 10;
          FA.draw.rect(part.x - 4, part.y + 12, 8, 6 + Math.random() * 8, '#0ff');
          ctx.restore();
        }
        FA.draw.sprite(category, spriteName, part.x - 10, part.y - 10, 20, ch, color);
      });

      // HP bar dla core
      if (part.type === 'core' && part.hp < part.maxHp) {
        FA.draw.bar(part.x - 12, part.y + 12, 24, 3, part.hp / part.maxHp, '#f44', '#400');
      }
    }

    ctx.restore();
  }

  function getPartColor(type, isPlayer, connected, colors) {
    if (!connected) return colors.disconnected;
    if (isPlayer) {
      if (type === 'core') return colors.playerCore;
      if (type === 'engine') return colors.playerEngine;
      if (type === 'gun') return colors.playerGun;
    } else {
      if (type === 'core') return colors.enemyCore;
      if (type === 'engine') return colors.enemyEngine;
      if (type === 'gun') return colors.enemyGun;
    }
    return colors.cargo;
  }

  window.Render = {
    setup: setupLayers
  };

})();
