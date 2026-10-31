/* Supabase client using plain fetch (no SDK). Pure helpers are exported for node tests. */
(function (root) {
  'use strict';
  function isConfigured(c) { return !!(c && /^(https:\/\/[a-z0-9-]+\.supabase\.co|http:\/\/(localhost|127\.0\.0\.1):\d+)$/.test(c.SUPABASE_URL || '') && c.SUPABASE_PUBLISHABLE_KEY && c.SUPABASE_PUBLISHABLE_KEY !== 'PASTE_PUBLISHABLE_KEY' && !/service_role|sb_secret_/.test(c.SUPABASE_PUBLISHABLE_KEY)); }
  // Magic-link redirect lands with "#access_token=...&refresh_token=...&expires_in=3600&..." (or "#error=...")
  function parseAuthHash(hash) {
    var h = String(hash || '').replace(/^#\/?/, ''); if (!/(^|&)(access_token|error)=/.test(h)) return null;
    var p = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    if (p.error) return { error: p.error_description || p.error };
    return { access_token: p.access_token, refresh_token: p.refresh_token, expires_at: Date.now() + (+p.expires_in || 3600) * 1000 };
  }
  // server rows -> the app's result map {matchId: {winner, game, status, by, at}}
  function toResultMap(rows) { var o = {}; (rows || []).forEach(function (r) { o[r.match_id] = { winner: r.winner, game: r.game, status: r.status, by: r.reported_by || 'exec', at: Date.parse(r.updated_at) || 0 }; }); return o; }
  // server players/matches -> per-league structures the UI uses
  function toLeagues(players, matches, cfgLeagues) {
    var L = {}; Object.keys(cfgLeagues).forEach(function (k) { L[k] = { key: k, cfg: cfgLeagues[k], ids: [], names: {}, sched: [] }; });
    players.slice().sort(function (a, b) { return +a.id.replace(/\D/g, '') - +b.id.replace(/\D/g, ''); }).forEach(function (p) { var l = L[p.league_id]; if (l) { l.ids.push(p.id); l.names[p.id] = p.name; } });
    matches.slice().sort(function (a, b) { return a.round - b.round || a.id.localeCompare(b.id); }).forEach(function (m) { var l = L[m.league_id]; if (l) l.sched.push({ id: m.id, round: m.round, week: m.week, home: m.home, away: m.away, sendBy: new Date(m.send_by), finishBy: new Date(m.finish_by) }); });
    return L;
  }
  function Client(cfg, storage) {
    var KEY = 'gpbl-live-session', sess = null, base = cfg.SUPABASE_URL, key = cfg.SUPABASE_PUBLISHABLE_KEY;
    try { sess = JSON.parse(storage.getItem(KEY)); } catch (e) { }
    function saveSess(s) { sess = s; try { s ? storage.setItem(KEY, JSON.stringify(s)) : storage.removeItem(KEY); } catch (e) { } }
    function timeout(ms) { var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal; }
    async function req(path, opt) {
      opt = opt || {}; var h = { apikey: key, 'Content-Type': 'application/json' };
      if (sess && sess.access_token) h.Authorization = 'Bearer ' + sess.access_token;
      var r = await fetch(base + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, signal: timeout(opt.timeout || 10000) });
      var txt = await r.text(), data = txt ? JSON.parse(txt) : null;
      if (!r.ok) { var e = new Error((data && (data.message || data.msg || data.error_description)) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
      return data;
    }
    async function refresh() {
      if (!sess || !sess.refresh_token) return;
      if (sess.expires_at - Date.now() > 120000) return;
      try { var d = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } }); saveSess({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + d.expires_in * 1000 }); }
      catch (e) { if (e.status === 400 || e.status === 401) saveSess(null); else throw e; }
    }
    return {
      adoptHash: function (hash) { var a = parseAuthHash(hash); if (a && !a.error) saveSess(a); return a; },
      signedIn: function () { return !!(sess && sess.access_token); },
      signOut: async function () { try { await req('/auth/v1/logout', { method: 'POST' }); } catch (e) { } saveSess(null); },
      sendMagicLink: function (email, redirect) { return req('/auth/v1/otp?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email: email, create_user: true } }); },
      loadStatic: async function () {
        var p = await req('/rest/v1/players?select=id,league_id,name,is_sample');
        var season = (await req('/rest/v1/seasons?select=id,label&is_current=eq.true&limit=1'))[0];
        if (!season) throw new Error('No current season');
        var m = await req('/rest/v1/matches?select=id,league_id,round,week,home,away,send_by,finish_by&season_id=eq.' + encodeURIComponent(season.id) + '&limit=5000');
        var w = await req('/rest/v1/weeks?select=week,start_at,send_by,finish_by&season_id=eq.' + encodeURIComponent(season.id) + '&order=week');
        return { players: p, matches: m, season: season, weeks: w };
      },
      loadResults: async function () { await refresh(); return req('/rest/v1/results?select=match_id,winner,game,status,reported_by,confirmed_by,disputed_by,updated_at&limit=5000'); },
      whoami: async function () { await refresh(); if (!this.signedIn()) return { role: 'anon' }; try { return await req('/rest/v1/rpc/whoami', { method: 'POST', body: {} }); } catch (e) { if (e.status === 401) { saveSess(null); return { role: 'anon' }; } throw e; } },
      rpc: async function (fn, args) { await refresh(); return req('/rest/v1/rpc/' + fn, { method: 'POST', body: args || {} }); }
    };
  }
  var api = { isConfigured: isConfigured, parseAuthHash: parseAuthHash, toResultMap: toResultMap, toLeagues: toLeagues, Client: Client };
  if (typeof module !== 'undefined') module.exports = api; else root.GPBL_LIVE = api;
})(this);
