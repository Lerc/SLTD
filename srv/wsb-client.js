// wsb-client.js — browser-bridge client.
//
// Drop this into any locally served web app to make the live page drivable
// from the `wsb` CLI. Configure it BEFORE this script runs:
//
//   <script>window.WSB = { app: 'myapp', version: '2026-07-16-1' };</script>
//   <script src="wsb-client.js"></script>
//
// Bump `version` every time you change the app so the CLI's --version guard
// can detect a stale page.
//
// The client only connects on a test-environment host (localhost by default;
// set WSB.force = true to connect elsewhere, or WSB.hosts to extend the list).
// On other hosts wslog() falls back to console.log and nothing else happens,
// so the snippet is safe to leave in deployed builds.
//
// What it provides once connected:
//   - hello handshake: reports {app, version, href} to the server
//   - wslog(msg): global log function, lines land in the server console buffer
//   - executes code dispatched by `wsb run` / `wsb eval` in an async wrapper
//     with a run-scoped wslog; the run auto-completes when the body resolves
//   - forwards window errors and unhandled promise rejections
//   - honours `wsb reload`; reconnects automatically (server can restart)

(function () {
  'use strict';

  var cfg = Object.assign({
    app:         'app',
    version:     'dev',
    url:         'ws://localhost:8787',
    hosts:       ['localhost', '127.0.0.1', '[::1]'],
    hookErrors:  true,
    force:       false,
    reconnectMs: 3000,
  }, self.WSB || {});

  function stringify(msg) {
    if (typeof msg === 'string') return msg;
    try { return JSON.stringify(msg); } catch (e) { return String(msg); }
  }

  var isTestHost = cfg.hosts.indexOf(self.location.hostname) !== -1;
  if (!isTestHost && !cfg.force) {
    self.wslog = function (msg) { console.log('[wslog]', stringify(msg)); };
    return;
  }

  var socket = null;
  var queue = [];          // messages buffered while (re)connecting
  var MAX_QUEUE = 500;

  function send(obj) {
    var str = JSON.stringify(obj);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(str);
    } else if (queue.length < MAX_QUEUE) {
      queue.push(str);
    }
  }

  function runCode(id, code) {
    var runLog = function (msg) {
      send({ kind: 'log', run: id, text: stringify(msg) });
    };
    var fn;
    try {
      fn = new Function('wslog', 'return (async () => {\n' + code + '\n})();');
    } catch (e) {
      send({ kind: 'done', run: id, ok: false, error: 'compile error: ' + e });
      return;
    }
    Promise.resolve().then(function () { return fn(runLog); }).then(
      function ()  { send({ kind: 'done', run: id, ok: true }); },
      function (e) { send({ kind: 'done', run: id, ok: false,
                            error: String(e && e.stack || e) }); }
    );
  }

  var retryTimer = null;
  function scheduleReconnect() {
    if (retryTimer !== null) return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      connect();
    }, cfg.reconnectMs);
  }

  function connect() {
    var ws;
    try { ws = new WebSocket(cfg.url); }
    catch (e) { scheduleReconnect(); return; }

    ws.onopen = function () {
      socket = ws;
      ws.send(JSON.stringify({
        kind: 'hello',
        app: cfg.app,
        version: cfg.version,
        href: self.location.href,
      }));
      while (queue.length) ws.send(queue.shift());
    };

    ws.onclose = function () {
      if (socket === ws) socket = null;
      scheduleReconnect();
    };

    ws.onerror = function () { /* onclose fires next */ };

    ws.onmessage = function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.kind === 'reload') { location.reload(); return; }
      if (msg.kind === 'run' && typeof msg.code === 'string') {
        runCode(msg.id, msg.code);
      }
    };
  }

  self.wslog = function (msg) {
    send({ kind: 'log', run: null, text: stringify(msg) });
  };

  if (cfg.hookErrors) {
    self.addEventListener('error', function (e) {
      send({ kind: 'log', run: null,
             text: '[onerror] ' + e.message + ' @ ' + e.filename + ':' + e.lineno });
    });
    self.addEventListener('unhandledrejection', function (e) {
      var r = e.reason;
      send({ kind: 'log', run: null,
             text: '[unhandledrejection] ' + String(r && r.stack || r) });
    });
  }

  connect();
})();
