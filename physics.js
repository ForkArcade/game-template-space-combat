// Space Combat — Physics
// Matematyka wektorowa, ciag, masa, kolizje, connectivity BFS
(function() {
  'use strict';
  var FA = window.FA;
  var cfg = FA.lookup('config', 'game');

  // === MASA I SRODEK MASY ===

  function getMass(parts) {
    var mass = 0, cx = 0, cy = 0;
    for (var i = 0; i < parts.length; i++) {
      var def = FA.lookup('partTypes', parts[i].type);
      var m = def ? def.mass : 5;
      mass += m;
      cx += parts[i].x * m;
      cy += parts[i].y * m;
    }
    if (mass === 0) return { mass: 1, cx: 0, cy: 0 };
    return { mass: mass, cx: cx / mass, cy: cy / mass };
  }

  // === CIAG ===

  function applyThrust(ship, part, force) {
    var m = getMass(ship.parts);
    var a = ship.angle;
    var cosA = Math.cos(a), sinA = Math.sin(a);
    // Sila w kierunku przodu statku (0 = gora, -Y w lokalnych)
    var fx = Math.sin(a) * force;
    var fy = -Math.cos(a) * force;
    // Pozycja czesci w swiecie
    var rx = ship.x + (part.x * cosA - part.y * sinA);
    var ry = ship.y + (part.x * sinA + part.y * cosA);
    // Srodek masy w swiecie
    var cxw = ship.x + (m.cx * cosA - m.cy * sinA);
    var cyw = ship.y + (m.cx * sinA + m.cy * cosA);
    // Torque: moment sily
    var dx = rx - cxw, dy = ry - cyw;
    ship.vx += fx / m.mass;
    ship.vy += fy / m.mass;
    ship.angVel += (dx * fy - dy * fx) / (m.mass * 100);
    if (!ship.activeEngines) ship.activeEngines = new Set();
    ship.activeEngines.add(part);
  }

  function applyTurn(ship, direction, power) {
    var engines = [];
    for (var i = 0; i < ship.parts.length; i++) {
      if (ship.parts[i].type === 'engine' && isConnected(ship.parts, i)) {
        engines.push(ship.parts[i]);
      }
    }
    if (direction === 'left') {
      for (var j = 0; j < engines.length; j++) {
        if (engines[j].x > 0) applyThrust(ship, engines[j], power);
      }
    }
    if (direction === 'right') {
      for (var k = 0; k < engines.length; k++) {
        if (engines[k].x < 0) applyThrust(ship, engines[k], power);
      }
    }
  }

  // === RUCH ===

  function updatePhysics(obj) {
    obj.x += obj.vx;
    obj.y += obj.vy;
    obj.angle += obj.angVel;
    obj.vx *= cfg.friction;
    obj.vy *= cfg.friction;
    obj.angVel *= cfg.angularFriction;
  }

  // === CONNECTIVITY BFS ===

  function isConnected(parts, index) {
    if (parts[index].type === 'core') return true;
    var coreIdx = -1;
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'core') { coreIdx = i; break; }
    }
    if (coreIdx === -1) return false;

    var visited = {};
    visited[coreIdx] = true;
    var queue = [coreIdx];
    while (queue.length) {
      var current = queue.shift();
      if (current === index) return true;
      var cp = parts[current];
      for (var j = 0; j < parts.length; j++) {
        if (!visited[j]) {
          var op = parts[j];
          if (Math.hypot(cp.x - op.x, cp.y - op.y) < cfg.partProximity) {
            visited[j] = true;
            queue.push(j);
          }
        }
      }
    }
    return false;
  }

  // === POZYCJA CZESCI W SWIECIE ===

  function worldPartPosition(ship, part) {
    var cosA = Math.cos(ship.angle), sinA = Math.sin(ship.angle);
    return {
      x: ship.x + part.x * cosA - part.y * sinA,
      y: ship.y + part.x * sinA + part.y * cosA
    };
  }

  // === KOLIZJA POCISK VS STATEK ===

  function checkBulletHit(bullet, ship) {
    var bestDist = 20; // promien trafienia
    var bestIdx = -1;
    for (var i = 0; i < ship.parts.length; i++) {
      var wp = worldPartPosition(ship, ship.parts[i]);
      var d = Math.hypot(bullet.x - wp.x, bullet.y - wp.y);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx >= 0 ? { partIndex: bestIdx } : null;
  }

  // === SNAP DO SIATKI ===

  function snapToGrid(x, y) {
    var g = cfg.gridSize;
    return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
  }

  // === TRANSFORMACJE KOORDYNATOW ===

  function worldToLocal(worldX, worldY, ship) {
    var dx = worldX - ship.x, dy = worldY - ship.y;
    var cosA = Math.cos(-ship.angle), sinA = Math.sin(-ship.angle);
    return { x: dx * cosA - dy * sinA, y: dx * sinA + dy * cosA };
  }

  function localToWorld(localX, localY, ship) {
    var cosA = Math.cos(ship.angle), sinA = Math.sin(ship.angle);
    return {
      x: ship.x + localX * cosA - localY * sinA,
      y: ship.y + localX * sinA + localY * cosA
    };
  }

  // === EKSPORT ===

  window.Physics = {
    getMass: getMass,
    applyThrust: applyThrust,
    applyTurn: applyTurn,
    updatePhysics: updatePhysics,
    isConnected: isConnected,
    worldPartPosition: worldPartPosition,
    checkBulletHit: checkBulletHit,
    snapToGrid: snapToGrid,
    worldToLocal: worldToLocal,
    localToWorld: localToWorld
  };

})();
