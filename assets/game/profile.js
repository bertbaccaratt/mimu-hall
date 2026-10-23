/* THE HALL: shared settings and the player profile.
   The profile is the single place where cards and scores are kept. Nobody is signed in yet, so every "save" below does nothing:
   runs are demo runs, nothing is stored, and nothing reaches the leaderboard. When the wallet sign-in is added later it only has to
   call HallProfile.connect({...}) with its own functions, and the game, the Collected app and the Leaderboard start working for real. */
(function () {
  'use strict';

  /* ---------- the game's numbers, in one place (the game, the Hall Rules and the admin page all read these) ---------- */
  var CONFIG = {
    climb: { pct: 3, everySec: 1800 },                                   // the run gets 3% faster every 30 minutes alive, compounding, no cap
    sight: {
      everySec: 1800,                                                    // a card sighting every 30 minutes alive
      locksSec: [0, 1800, 3600, 7200, 10800],                            // Common, Uncommon, Rare, Prestige, Legendary open after this long alive in the run
      odds: [60, 21, 7, 6.5, 3.3],                                       // chance weights among the tiers that are open
      unlockShare: 0.6,                                                  // a tier opens once you own 60% of the tier below it
      dupChance: 0.2,                                                    // one sighting in five may be a card you already own
      lucky: { afterSec: 3600, prestige: 0.005, legendary: 0.001 }       // a tiny chance of a top card in shorter runs
    },
    pack: { firstSec: 8100, everySec: 9000, slowPct: 20, slowSec: 60 },  // the black pack: 2:15, then every 2.5 hours alive; slows you 20% for 60 s
    hp: { segments: 6, dmg: { plain: 2, red: 6, blue: 3 } },             // plain box 3 hits, blue 2, red 1
    coinPoints: 25
  };
  var TEST = { sight: { everySec: 12 }, pack: { firstSec: 40, everySec: 70 } };   // admin test mode: everything happens quickly, nothing is saved

  var TIERS = [
    { n: 1, key: 'common', name: 'Common', color: '#ffffff', glow: '255,255,255' },
    { n: 2, key: 'uncommon', name: 'Uncommon', color: '#5fd37a', glow: '95,211,122' },
    { n: 3, key: 'rare', name: 'Rare', color: '#4aa3ff', glow: '74,163,255' },
    { n: 4, key: 'prestige', name: 'Prestige', color: '#f0c24a', glow: '240,194,74' },
    { n: 5, key: 'legendary', name: 'Legendary', color: '#47d1ff', glow: '120,170,255', grad: 'linear-gradient(90deg,#47d1ff,#c358d1)' }
  ];
  var FAMILIES = [
    { key: 'club', name: 'Club' }, { key: 'mutant', name: 'Mutant' }, { key: 'cosmic', name: 'Cosmic' }, { key: 'arcana', name: 'Arcana' }
  ];

  /* ---------- the 120 cards ---------- */
  var cards = [], readyCbs = [];
  function pad3(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }
  fetch('assets/game/cards.json').then(function (r) { return r.json(); }).then(function (list) {
    cards = list.map(function (c) { return { n: c.n, name: c.name, tier: c.t, family: c.f, file: 'assets/game/cards/' + pad3(c.n) + '.webp' }; });
    TIERS.forEach(function (t) { t.count = cards.filter(function (c) { return c.tier === t.n; }).length; });
    FAMILIES.forEach(function (f) { f.count = cards.filter(function (c) { return c.family === f.key; }).length; });
    readyCbs.splice(0).forEach(function (cb) { cb(); });
  }).catch(function () {});

  /* ---------- the player ---------- */
  var adapter = null, listeners = [];
  function emit(what) { listeners.forEach(function (fn) { try { fn(what); } catch (e) {} }); }
  var P = {
    config: CONFIG, testConfig: TEST, tiers: TIERS, families: FAMILIES,
    cards: function () { return cards; },
    card: function (n) { return cards[n - 1]; },
    whenReady: function (cb) { if (cards.length) cb(); else readyCbs.push(cb); },
    isTest: function () { try { return localStorage.getItem('hall-test') === '1'; } catch (e) { return false; } },
    setTest: function (on) { try { localStorage.setItem('hall-test', on ? '1' : '0'); } catch (e) {} emit('test'); },
    isSignedIn: function () { return !!adapter; },
    username: function () { return adapter && adapter.username ? adapter.username() : null; },
    owned: function () { return adapter && adapter.owned ? adapter.owned() : new Set(); },       // a Set of card numbers
    addCard: function (n) { if (!adapter || !adapter.addCard) return false; var r = adapter.addCard(n); emit('cards'); return r; },
    recordRun: function (run) { if (!adapter || !adapter.recordRun) return false; var r = adapter.recordRun(run); emit('scores'); return r; },
    totals: function () { return adapter && adapter.totals ? adapter.totals() : { lifetime: 0, best: 0, last: 0 }; },
    deckBoard: function () { return adapter && adapter.deckBoard ? adapter.deckBoard() : Promise.resolve([]); },   // top 10 by deck progress: [{ username, owned, rarest, family, runs, best }]
    leaderboard: function (kind) { return adapter && adapter.leaderboard ? adapter.leaderboard(kind) : Promise.resolve([]); },   // kind: 'lifetime' | 'best' | 'last'
    onChange: function (fn) { listeners.push(fn); },
    connect: function (a) { adapter = a; emit('connect'); },
    disconnect: function () { adapter = null; emit('connect'); }
  };
  window.HallProfile = P;
})();
