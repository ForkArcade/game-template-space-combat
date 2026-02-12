// Space Combat — Data
// Definicje: konfiguracja, typy czesci, uklady statkow, dzwieki, narracja
(function() {
  'use strict';
  var FA = window.FA;

  // === CONFIG ===
  FA.register('config', 'game', {
    canvasWidth: 1000,
    canvasHeight: 800,
    gridSize: 30,
    partProximity: 40,
    bulletSpeed: 10,
    bulletLife: 100,
    shootCooldown: 150,
    thrustBase: 0.4,
    turboMultiplier: 1.8,
    friction: 0.98,
    angularFriction: 0.9,
    enemySpawnDistance: 500,
    floatingPartLife: 900,
    pickupRadius: 40
  });

  FA.register('config', 'colors', {
    bg: '#001122',
    gridLine: '#112244',
    playerCore: '#f44', playerEngine: '#4f4', playerGun: '#44f',
    enemyCore: '#f84', enemyEngine: '#8f4', enemyGun: '#48f',
    cargo: '#ee4', disconnected: '#555',
    bulletFriendly: '#0ff', bulletEnemy: '#f44',
    text: '#fff', dim: '#777',
    narrative: '#c8b4ff'
  });

  FA.register('config', 'scoring', {
    killMultiplier: 100,
    partCollectedMultiplier: 25,
    damageMultiplier: 2,
    survivalPerSecond: 1
  });

  // === TYPY CZESCI ===
  FA.register('partTypes', 'core',   { name: 'Rdzen',    mass: 10, maxHp: 8, char: 'O' });
  FA.register('partTypes', 'engine', { name: 'Silnik',   mass: 5,  maxHp: 3, char: 'E' });
  FA.register('partTypes', 'gun',    { name: 'Dzialo',   mass: 5,  maxHp: 2, char: 'G' });
  FA.register('partTypes', 'cargo',  { name: 'Ladownia', mass: 5,  maxHp: 2, char: 'C' });

  // === UKLADY STATKOW ===
  FA.register('shipLayouts', 'player_default', {
    parts: [
      { x: 0, y: 0, type: 'core' },
      { x: 0, y: 30, type: 'engine' },
      { x: -30, y: 30, type: 'engine' },
      { x: 30, y: 30, type: 'engine' },
      { x: 0, y: -30, type: 'gun' },
      { x: -30, y: -30, type: 'gun' },
      { x: 30, y: -30, type: 'gun' }
    ]
  });

  FA.register('shipLayouts', 'enemy_fighter', {
    parts: [
      { x: 0, y: 0, type: 'core' },
      { x: 0, y: 30, type: 'engine' },
      { x: -30, y: 0, type: 'engine' },
      { x: 30, y: 0, type: 'engine' },
      { x: 0, y: -30, type: 'gun' },
      { x: -30, y: -30, type: 'gun' },
      { x: 30, y: -30, type: 'gun' }
    ]
  });

  FA.register('shipLayouts', 'enemy_heavy', {
    parts: [
      { x: 0, y: 0, type: 'core' },
      { x: 0, y: -60, type: 'gun' },
      { x: -30, y: -30, type: 'cargo' },
      { x: 0, y: -30, type: 'cargo' },
      { x: 30, y: -30, type: 'cargo' },
      { x: -60, y: 0, type: 'engine' },
      { x: 60, y: 0, type: 'engine' },
      { x: 0, y: 30, type: 'cargo' }
    ]
  });

  // TODO: wiecej ukladow wrogow

  // === DZWIEKI ===
  FA.defineSound('shoot', function(actx, dest) {
    var osc = actx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, actx.currentTime + 0.05);
    osc.connect(dest);
    osc.start();
    osc.stop(actx.currentTime + 0.05);
  });

  FA.defineSound('explosion', function(actx, dest) {
    var osc = actx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, actx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, actx.currentTime + 0.3);
    var g = actx.createGain();
    g.gain.setValueAtTime(0.8, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.3);
    osc.connect(g);
    g.connect(dest);
    osc.start();
    osc.stop(actx.currentTime + 0.3);
  });

  FA.defineSound('thrustLoop', function(actx, dest) {
    var osc = actx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(60, actx.currentTime);
    var g = actx.createGain();
    g.gain.setValueAtTime(0.15, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.08);
    osc.connect(g);
    g.connect(dest);
    osc.start();
    osc.stop(actx.currentTime + 0.08);
  });

  // === NARRACJA ===
  FA.register('config', 'narrative', {
    startNode: 'launch',
    variables: { kills: 0, parts_collected: 0, ship_size: 7 },
    graph: {
      nodes: [
        { id: 'launch', label: 'Start misji', type: 'scene' },
        { id: 'first_kill', label: 'Pierwszy fraг', type: 'scene' },
        { id: 'ship_growing', label: 'Statek rosnie', type: 'scene' },
        { id: 'overwhelmed', label: 'Przewaga wroga', type: 'scene' },
        { id: 'destroyed', label: 'Zniszczony', type: 'scene' }
      ],
      edges: [
        { from: 'launch', to: 'first_kill' },
        { from: 'first_kill', to: 'ship_growing' },
        { from: 'ship_growing', to: 'overwhelmed' },
        { from: 'overwhelmed', to: 'destroyed' },
        { from: 'launch', to: 'destroyed' }
      ]
    }
  });

  FA.register('narrativeText', 'launch', {
    text: 'Silniki odpalone. Pusta przestrzen czeka.',
    color: '#c8b4ff'
  });

  FA.register('narrativeText', 'first_kill', {
    text: 'Pierwszy wrog zniszczony. Zbierz jego czesci.',
    color: '#c8b4ff'
  });

  FA.register('narrativeText', 'ship_growing', {
    text: 'Statek rosnie. Wiecej silnikow, wiecej ognia.',
    color: '#c8b4ff'
  });

  FA.register('narrativeText', 'overwhelmed', {
    text: 'Za duzo wrogow. Trzymaj sie.',
    color: '#f88'
  });

  FA.register('narrativeText', 'destroyed', {
    text: 'Rdzen zniszczony. Koniec podrozy.',
    color: '#f44'
  });

  // TODO: wiecej wezlow narracji

})();
