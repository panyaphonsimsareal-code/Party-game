/*
 * PARTY STUDIO — PARTYGAME PLAYER COUNTER v1.0
 * --------------------------------------------------------------
 * WHAT IT COUNTS:
 *   Approximate number of distinct BROWSERS that began playing PARTYGAME.
 *   One successful increment per browser profile (localStorage).
 *   It does NOT count exact individual people or users online right now.
 *   Clearing site data / using another browser can count again.
 *
 * PRIVACY:
 *   No account name, email, game text, precise location, device ID,
 *   fingerprint, or custom identifier is collected or sent by this file.
 *   The external counter service still receives a normal network request
 *   (potentially including an IP address and ordinary connection metadata).
 *   Explain this in privacy.html before publishing.
 *
 * SETUP:
 *  1. Upload player-counter.js in the Party-game repository root.
 *  2. Add this script in partygame.html (Claude / maintainer):
 *       <script src="./player-counter.js" defer></script>
 *  3. When the player actually STARTS their FIRST mini-game, call:
 *       window.PartyPlayerCounter?.recordFirstPlay();
 *     Call it on subsequent game starts too: it automatically de-duplicates.
 *     NOTE: merely uploading this file DOES NOT count anyone.
 *  4. OPTIONAL: to show the current total, add to the game's UI:
 *       <span data-party-player-count>—</span>
 *     And call window.PartyPlayerCounter?.refresh() where appropriate.
 *
 * SAFETY:
 *   This file never changes gameplay, rewards, player accounts, or rooms.
 *   It only operates on the official GitHub Pages game domain.
 *   Counter is public & can be manipulated: NOT suitable for reward payouts.
 */
(function () {
  'use strict';
  if (window.PartyPlayerCounter) return;

  var API = 'https://abacus.jasoncameron.dev';
  var NAMESPACE = 'party-studio-2026-player-metrics';
  var KEY = 'first-play-browser';
  var STORE_KEY = 'partygame-first-play-counted-v1';
  var PENDING_KEY = 'partygame-first-play-pending-v1';
  var PENDING_TTL = 20000;
  var latest = null;
  var activeRequest = null;

  function onOfficialSite() {
    try {
      return location.protocol === 'https:' &&
        location.hostname === 'panyaphonsimsareal-code.github.io' &&
        /^\/Party-game(?:\/|$)/.test(location.pathname);
    } catch (_) { return false; }
  }

  function storageAvailable() {
    try {
      var k = '__party_pc_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (_) { return false; }
  }

  function counted() {
    try { return localStorage.getItem(STORE_KEY) === '1'; }
    catch (_) { return false; }
  }

  function setDisplay(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return;
    latest = Math.floor(value);
    try {
      var nodes = document.querySelectorAll('[data-party-player-count]');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].textContent = latest.toLocaleString('th-TH');
      }
    } catch (_) {}
  }

  async function request(kind) {
    var path = API + '/' + kind + '/' + NAMESPACE + '/' + KEY;
    var res = await fetch(path, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    });
    if (!res.ok) throw new Error('counter unavailable');
    var data = await res.json();
    if (!data || !Number.isSafeInteger(data.value) || data.value < 0) {
      throw new Error('invalid counter response');
    }
    setDisplay(data.value);
    return data.value;
  }

  async function refresh() {
    if (!onOfficialSite()) return null;
    try { return await request('get'); } catch (_) { return null; }
  }

  async function recordFirstPlay() {
    // Prevent accidental increments during local previews, testing, or copies.
    if (!onOfficialSite()) return { counted: false, reason: 'not-official-site' };
    try { if (navigator.webdriver) return { counted: false, reason: 'automated-test' }; }
    catch (_) {}
    if (!storageAvailable()) return { counted: false, reason: 'storage-unavailable' };
    if (counted()) { await refresh(); return { counted: false, reason: 'already-counted', value: latest }; }
    if (activeRequest) return activeRequest;

    var now = Date.now();
    try {
      var lastPending = Number(localStorage.getItem(PENDING_KEY)) || 0;
      if (lastPending > 0 && now - lastPending < PENDING_TTL && now >= lastPending) {
        return { counted: false, reason: 'another-tab-pending' };
      }
      localStorage.setItem(PENDING_KEY, String(now));
    } catch (_) { return { counted: false, reason: 'storage-unavailable' }; }

    activeRequest = (async function () {
      try {
        // Best-effort check in case another tab completed just before the hit.
        if (counted()) return { counted: false, reason: 'already-counted' };
        var value = await request('hit');
        try { localStorage.setItem(STORE_KEY, '1'); } catch (_) {}
        return { counted: true, value: value };
      } catch (_) {
        return { counted: false, reason: 'counter-unavailable' };
      } finally {
        try {
          if (localStorage.getItem(PENDING_KEY) === String(now)) {
            localStorage.removeItem(PENDING_KEY);
          }
        } catch (_) {}
        activeRequest = null;
      }
    })();
    return activeRequest;
  }

  window.PartyPlayerCounter = Object.freeze({
    version: '1.0',
    recordFirstPlay: recordFirstPlay,
    refresh: refresh,
    isCountedHere: counted,
    lastValue: function () { return latest; }
  });

  // Read-only auto-refresh when a count display is present; never auto-increment.
  function initializeDisplay() {
    try {
      if (document.querySelector('[data-party-player-count]')) refresh();
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDisplay, { once: true });
  } else {
    initializeDisplay();
  }
})();
