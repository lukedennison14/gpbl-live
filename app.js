(function () {
  'use strict';
  var D = GPBL_DATA, S = D.season, KEY = 'gpbl-demo-v1';
  var $app = document.getElementById('app');
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var WEEKS = GPBL.weekWindows(S.year, S.month, S.offset);
  var loadT = Date.now(), DEMO_NOW = new Date(S.demoNow).getTime();
  var CFG = window.GPBL_CONFIG || {}, MODE = 'demo', LIVE = null, ME = { role: 'anon' }, POLL = null;
  function now() { return MODE === 'live' ? Date.now() : DEMO_NOW + (Date.now() - loadT); } // demo clock: mid-season, ticking
  var fmt = function (d) { return new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'; };

  // ---------- league model ----------
  var L = {};
  Object.keys(D.leagues).forEach(function (k, li) {
    var lg = D.leagues[k], ids = lg.players.map(function (_, i) { return k + i; });
    var names = {}; ids.forEach(function (id, i) { names[id] = lg.players[i]; });
    var sched = GPBL.roundRobin(ids, WEEKS).map(function (m) { m.id = k + '-' + m.id; return m; });
    L[k] = { key: k, cfg: lg, ids: ids, names: names, sched: sched };
  });
  function seedResults() {
    var res = {}, r = GPBL.rng(2026);
    Object.keys(L).forEach(function (k) {
      L[k].sched.forEach(function (m) {
        var end = m.finishBy.getTime(), roundT = WEEKS[m.week - 1].start.getTime() + (m.round % 5) * 18 * 3600e3;
        if (roundT > DEMO_NOW - 6 * 3600e3) return;
        var hi = L[k].ids.indexOf(m.home), ai = L[k].ids.indexOf(m.away);
        var x = r(), pHome = 0.5 + (ai - hi) * 0.025;
        var winner = x < 0.06 ? 'draw' : (r() < pHome ? m.home : m.away);
        res[m.id] = { winner: winner, game: D.games[Math.floor(r() * D.games.length)], status: r() < 0.07 ? 'pending' : 'confirmed', by: winner === 'draw' ? m.home : winner, at: roundT };
      });
    });
    return res;
  }
  var state;
  function load() { try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { } if (!state || !state.results) state = { results: seedResults(), me: 'premier3', league: 'premier', exec: false }; }
  function save() { if (MODE === 'live') return; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }
  load();
  function leagueOf(id) { return L[id.replace(/\d+$/, '')]; }
  function nameOf(id) { var l = leagueOf(id); return l ? l.names[id] : id; }
  function resultsFor(k) { return L[k].sched.map(function (m) { var r = state.results[m.id]; return r ? { home: m.home, away: m.away, winner: r.winner, status: r.status, at: r.at } : null; }).filter(Boolean); }
  function table(k) { return GPBL.standings(L[k].ids, resultsFor(k)); }
  function isSample(n) { return /^Sample Player/.test(n); }
  function nm(id) { var n = nameOf(id); return isSample(n) ? '<span class="m-meta">' + esc(n) + '</span>' : esc(n); }

  // ---------- nav ----------
  var NAV = [['League', [['', 'Home'], ['match', 'My next match'], ['schedule', 'Schedule'], ['standings', 'Standings'], ['bracket', 'Tournament bracket']]],
    ['Glory', [['belts', 'Title belts'], ['trophies', 'Trophy room'], ['records', 'Hall of records'], ['archive', 'Archive'], ['fit', 'Fit Pigeon']]],
    ['Info', [['rules', 'Rulebook'], ['join', 'Join the league'], ['merch', 'Merch'], ['about', 'About & team'], ['proposal', 'Proposal for execs'], ['account', 'Account / sign in'], ['exec', 'Exec: claims']]]];
  var TABS = [['', '⌂', 'Home'], ['match', '◎', 'My match'], ['standings', '▤', 'Standings'], ['bracket', '⟁', 'Bracket'], ['more', '☰', 'More']];
  var drawer = document.getElementById('drawer'), menuBtn = document.getElementById('menuBtn');
  function setDrawer(open) { drawer.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', open); }
  menuBtn.onclick = function () { setDrawer(!drawer.classList.contains('open')); };
  drawer.addEventListener('click', function (e) { if (e.target.closest('a,.close')) setDrawer(false); });

  // ---------- pages ----------
  var P = {};
  function leagueSeg(route) { return '<div class="seg">' + Object.keys(L).map(function (k) { return '<button data-league="' + k + '" class="' + (state.league === k ? 'on' : '') + '">' + esc(L[k].cfg.short) + '</button>'; }).join('') + '</div>'; }
  function myNext(me) {
    var l = leagueOf(me); return l.sched.filter(function (m) { var r = state.results[m.id]; return (m.home === me || m.away === me) && (!r || r.status !== 'confirmed' && r.status !== 'resolved'); })[0];
  }
  function countdown(t) { var ms = Math.max(0, t - now()), d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3); return '<div class="count" data-cd="' + t + '"><div><b>' + d + '</b><span>days</span></div><div><b>' + h + '</b><span>hrs</span></div><div><b>' + m + '</b><span>min</span></div><div><b>' + s + '</b><span>sec</span></div></div>'; }
  function statusPill(m) { var r = state.results[m.id]; if (!r) return m.finishBy.getTime() < now() ? '<span class="pill bad">Overdue</span>' : '<span class="pill">Open</span>'; if (r.status === 'pending') return '<span class="pill warn">Awaiting confirm</span>'; if (r.status === 'disputed') return '<span class="pill bad">Disputed</span>'; return '<span class="pill">' + (r.winner === 'draw' ? 'Draw' : esc(nameOf(r.winner).split(' ')[0]) + ' won') + '</span>'; }

  P[''] = function () {
    var k = 'premier', t = table(k).slice(0, 5), wk = WEEKS.filter(function (w) { return now() < w.end.getTime(); })[0] || WEEKS[3];
    var pend = Object.keys(state.results).filter(function (id) { return state.results[id].status === 'pending'; }).length;
    return '<section class="hero"><picture class="hero-art"><source type="image/webp" srcset="hero-800.webp 800w, hero.webp 1280w" sizes="(min-width:1100px) 1100px, 100vw"><img src="hero.jpg" width="1280" height="960" alt="Pixel-art autumn feast with pigeons, swans, an eagle and owls" fetchpriority="high"></picture><div class="hero-body"><h1>GamePigeon<br>Battle League</h1><p class="tag">Gotta catch \'em all.</p><div class="row"><a class="btn" href="#/match">My next match</a><a class="btn ghost" href="#/standings">Standings</a></div><p style="margin:16px 0 26px;color:var(--mute)">' + esc(S.label) + ' season · Week ' + wk.week + ' · Finish by ' + fmt(wk.end) + '</p></div></section>' +
      '<div class="grid two"><div class="card"><h3>Week ' + wk.week + ' deadlines</h3><p class="m-meta">Away player must send or start by</p><p><b>' + fmt(wk.sendBy) + '</b></p><p class="m-meta">All matches finished by</p><p><b>' + fmt(wk.end) + '</b></p>' + countdown(wk.end.getTime()) + '</div>' +
      '<div class="card"><h3>Premier League top 5</h3><ul class="list">' + t.map(function (r) { return '<li><span>' + r.rank + '. ' + nm(r.id) + '</span><span class="m-meta">' + r.w + '-' + r.l + '-' + r.d + ' · <b style="color:var(--gold)">' + r.pts + '</b> pts</span></li>'; }).join('') + '</ul><p><a href="#/standings">Full standings →</a></p></div></div>' +
      '<div class="grid three"><a class="card" style="text-decoration:none;color:inherit" href="#/standings"><h3>Premier League</h3><p class="m-meta">20 players · top 14 to the tournament · bottom 6 relegated</p></a><a class="card" style="text-decoration:none;color:inherit" href="#/standings" data-league="b"><h3>B-League</h3><p class="m-meta">20 players · promotion tournament</p></a><a class="card" style="text-decoration:none;color:inherit" href="#/standings" data-league="nest"><h3>The Nest</h3><p class="m-meta">C-League · where legends hatch</p></a></div>' +
      (pend ? '<div class="note">' + pend + ' reported results are waiting for the opponent to confirm.</div>' : '') +
      '<div class="grid two"><div class="card"><h3>New this season</h3><p class="m-meta">Report a result in two taps. Your opponent confirms, standings update instantly. No more waiting for someone to type it into a sheet.</p><a href="#/proposal">What changed and why →</a></div><div class="card"><h3>Join the flock</h3><p class="m-meta">$5 a season. Monthly seasons, real payouts, title belts.</p><div class="row"><a class="btn sm" href="#/join">Join</a><a class="btn ghost sm" href="' + D.links.discord + '">Discord (link TBD)</a></div></div></div>';
  };

  P.match = function () {
    var live = MODE === 'live';
    if (live && !ME.player_id) return '<h1>My next match</h1>' + accountHtml();
    if (live) state.me = ME.player_id;
    var opts = Object.keys(L).map(function (k) { return '<optgroup label="' + esc(L[k].cfg.name) + '">' + L[k].ids.map(function (id) { return '<option value="' + id + '"' + (id === state.me ? ' selected' : '') + '>' + esc(L[k].names[id]) + '</option>'; }).join('') + '</optgroup>'; }).join('');
    var me = state.me, l = leagueOf(me), m = myNext(me), body;
    if (!m) body = '<div class="card empty">No open matches. You\'re done for the season.</div>';
    else {
      var home = m.home === me, opp = home ? m.away : m.home, r = state.results[m.id], w = WEEKS[m.week - 1];
      body = '<div class="card"><div class="row" style="justify-content:space-between"><span class="pill ' + (home ? 'home' : 'away') + '">' + (home ? 'HOME · you send first' : 'AWAY · you play back') + '</span><span class="m-meta">Week ' + m.week + ' · Round ' + m.round + '</span></div>' +
        '<div class="vs"><div class="who">' + esc(nameOf(me)) + '</div><div class="x">VS</div><div class="who">' + esc(nameOf(opp)) + '</div></div>' +
        '<p class="m-meta" style="text-align:center">' + (home ? 'Send the first game in iMessage and label it official.' : 'Your opponent sends first. Play it back before the send/start deadline.') + '</p>' +
        '<ul class="list"><li><span>Send / start deadline</span><b>' + fmt(m.sendBy) + '</b></li><li><span>Finish deadline</span><b>' + fmt(m.finishBy) + '</b></li><li><span>Each later turn</span><b>within 24 hours</b></li></ul>' +
        '<p class="m-meta" style="margin-top:12px">Time left to finish</p>' + countdown(m.finishBy.getTime()) +
        (r && r.status === 'pending' ? (r.by === me ? '<div class="note">You reported this. Waiting for ' + esc(nameOf(opp)) + ' to confirm.</div>' : '<div class="note">' + esc(nameOf(r.by)) + ' reported: ' + (r.winner === 'draw' ? 'Draw' : esc(nameOf(r.winner)) + ' won') + ' in ' + esc(r.game) + '.</div><div class="row"><button class="btn green" data-act="confirm" data-id="' + m.id + '">Confirm</button><button class="btn red" data-act="dispute" data-id="' + m.id + '">Dispute</button></div>')
          : r && r.status === 'disputed' ? '<div class="note">Disputed. An executive will resolve it.</div>' : '<button class="btn" style="width:100%;margin-top:6px" data-act="report" data-id="' + m.id + '">Report result</button>') + '</div>';
      var mine = l.sched.filter(function (x) { return x.home === me || x.away === me; });
      var toConfirm = mine.filter(function (x) { var rr = state.results[x.id]; return x !== m && rr && rr.status === 'pending' && rr.by !== me; });
      if (toConfirm.length) body = '<h2>Needs your confirmation</h2>' + toConfirm.map(function (x) { var rr = state.results[x.id]; return '<div class="card"><p>' + esc(nameOf(rr.by)) + ' reported: <b>' + (rr.winner === 'draw' ? 'Draw' : esc(nameOf(rr.winner)) + ' won') + '</b> in ' + esc(rr.game) + ' <span class="m-meta">(Wk ' + x.week + ')</span></p><div class="row"><button class="btn green" data-act="confirm" data-id="' + x.id + '">Confirm</button><button class="btn red" data-act="dispute" data-id="' + x.id + '">Dispute</button></div></div>'; }).join('') + '<h2>Next up</h2>' + body;
      body += '<h2>My season</h2><div class="card"><ul class="list">' + mine.map(function (x) { var o = x.home === me ? x.away : x.home; return '<li><span><span class="pill ' + (x.home === me ? 'home' : 'away') + '">' + (x.home === me ? 'H' : 'A') + '</span> ' + nm(o) + '<br><span class="m-meta">Wk ' + x.week + ' · due ' + fmt(x.finishBy) + '</span></span>' + statusPill(x) + '</li>'; }).join('') + '</ul></div>';
    }
    if (live) return '<h1>My next match</h1><p class="sub">Signed in as ' + esc(nameOf(me)) + ' · <a href="#/account">account</a></p>' + body;
    return '<h1>My next match</h1><p class="sub">Demo: pick who you are. In the live version you sign in once.</p><label for="me">I am</label><select id="me">' + opts + '</select><div style="height:14px"></div>' + body;
  };

  P.schedule = function () {
    var l = L[state.league], wk = +(state.week || 1);
    var ms = l.sched.filter(function (m) { return m.week === wk; }), w = WEEKS[wk - 1];
    return '<h1>Schedule</h1><p class="sub">' + esc(S.label) + ' · all times US Eastern</p>' + leagueSeg() +
      '<div class="seg">' + WEEKS.map(function (x) { return '<button data-week="' + x.week + '" class="' + (x.week === wk ? 'on' : '') + '">Week ' + x.week + '</button>'; }).join('') + '</div>' +
      '<div class="card"><ul class="list"><li><span>Window</span><b>' + fmt(w.start) + ' – ' + fmt(w.end) + '</b></li><li><span>Send / start by</span><b>' + fmt(w.sendBy) + '</b></li></ul></div>' +
      '<div class="card"><ul class="list">' + ms.map(function (m) { return '<li><span><span class="pill home">H</span> ' + nm(m.home) + '<br><span class="pill away">A</span> ' + nm(m.away) + '</span><span style="text-align:right">' + statusPill(m) + (state.exec ? '<br><button class="btn ghost sm" style="margin-top:6px" data-act="report" data-id="' + m.id + '">Set result</button>' : '') + '</span></li>'; }).join('') + '</ul></div>' + execToggle();
  };
  function execToggle() { if (MODE === 'live') return ME.role === 'exec' ? '<div class="card"><div class="row" style="justify-content:space-between"><span><b>Executive mode</b><br><span class="m-meta">You are an executive. Overrides are saved as final and logged.</span></span><button class="btn ' + (state.exec ? 'green' : 'ghost') + ' sm" data-act="exec">' + (state.exec ? 'On' : 'Off') + '</button></div></div>' : ''; return '<div class="card"><div class="row" style="justify-content:space-between"><span><b>Executive mode</b><br><span class="m-meta">DEMO ONLY: no login. Real version restricts this to execs.</span></span><button class="btn ' + (state.exec ? 'green' : 'ghost') + ' sm" data-act="exec">' + (state.exec ? 'On' : 'Off') + '</button></div></div>'; }

  P.standings = function () {
    var l = L[state.league], c = l.cfg, t = table(state.league);
    var rows = t.map(function (r) {
      var z = r.rank <= c.byes ? 'zone-bye' : r.rank <= c.cut ? 'zone-in' : c.relegate && r.rank > 20 - c.relegate ? 'zone-rel' : '';
      var cls = (r.id === state.me ? 'me ' : '') + (r.rank === c.cut ? 'cut' : '');
      return '<tr class="' + cls + '"><td class="rk ' + z + '">' + r.rank + '</td><td>' + nm(r.id) + (r.tb ? ' <span class="pill" title="tiebreak">' + (r.tb === 'head-to-head' ? 'H2H' : 'TB') + '</span>' : '') + '</td><td>' + r.w + '</td><td>' + r.l + '</td><td>' + r.d + '</td><td class="hide-sm">' + r.gp + '</td><td><b>' + r.pts + '</b></td><td>' + (r.pct * 100).toFixed(1) + '</td><td class="hide-sm">' + r.streak + '</td></tr>';
    }).join('');
    return '<h1>Standings</h1><p class="sub">Calculated live from confirmed results. Win 3 · Draw 1 · Loss 0.</p>' + leagueSeg() +
      '<div class="card" style="padding:8px"><table><thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>D</th><th class="hide-sm">GP</th><th>Pts</th><th>Win%</th><th class="hide-sm">Strk</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="legend">' + (c.byes ? '<span><i style="background:var(--gold)"></i>Top ' + c.byes + ': tournament bye</span>' : '') + '<span><i style="background:var(--green)"></i>Top ' + c.cut + ': tournament</span>' + (c.relegate ? '<span><i style="background:var(--red)"></i>Bottom ' + c.relegate + ': relegated</span>' : '') + '</div>' +
      (c.promote ? '<div class="note">' + esc(c.promote) + '.</div>' : '') +
      '<div class="note">Tiebreakers: 1) win % (a draw counts as half a win), 2) head-to-head, 3) best-of-3 playoff. H2H = decided by head-to-head; TB = still tied, playoff needed.</div>';
  };

  P.bracket = function () {
    var l = L[state.league], c = l.cfg, seeds = table(state.league).slice(0, c.cut).map(function (r) { return r.id; });
    var b = GPBL.bracket(seeds, c.byes), rounds = [], cur = b.round1, names = ['Round 1', 'Round of 8', 'Semifinals', 'Final'];
    if (b.size === 8) names = ['Quarterfinals', 'Semifinals', 'Final'];
    var n = cur.length; rounds.push(cur); while (n > 1) { n /= 2; rounds.push(Array(n).fill(null)); }
    function slot(x) { return x ? '<div><span class="s">' + x.seed + '</span>' + nm(x.id) + '</div>' : '<div class="tbd">Bye</div>'; }
    var html = rounds.map(function (rd, i) {
      return '<div class="bround"><h4>' + names[i] + '</h4>' + rd.map(function (m, j) {
        if (i === 0) return '<div class="bm">' + slot(m[0]) + slot(m[1]) + '</div>';
        if (i === 1) { var adv = function (p) { return p[0] && !p[1] ? slot(p[0]) : !p[0] && p[1] ? slot(p[1]) : '<div class="tbd">Winner ' + (p[0] ? p[0].seed : '') + '/' + (p[1] ? p[1].seed : '') + '</div>'; }; return '<div class="bm">' + adv(rounds[0][j * 2]) + adv(rounds[0][j * 2 + 1]) + '</div>'; }
        return '<div class="bm"><div class="tbd">TBD</div><div class="tbd">TBD</div></div>';
      }).join('') + '</div>';
    }).join('');
    return '<h1>Tournament</h1><p class="sub">Projected from current standings. Single elimination, best-of-majority, higher seed is home. Draws are replayed.</p>' + leagueSeg() + '<div class="bracket">' + html + '</div><p class="m-meta">Swipe sideways to see later rounds.</p>' + (c.byes ? '<div class="note">Top ' + c.byes + ' seeds get a first-round bye.</div>' : '');
  };

  P.rules = function () {
    var sec = function (t, b) { return '<div class="card"><h3>' + t + '</h3>' + b + '</div>'; };
    return '<h1>Official Rulebook</h1><p class="sub">Plain-English summary. The <a href="' + D.links.rulebook + '" target="_blank" rel="noopener">official Google Doc</a> is the source of truth.</p>' +
      sec('Entry', '<p>$5 per season, paid by Apple Cash or Venmo to the treasurer.</p>') +
      sec('Games', '<p>' + D.games.map(esc).join(' · ') + '</p><p class="m-meta">8 Ball and 9 Ball are played on hard only.</p>') +
      sec('Seasons', '<p>Seasons are monthly: a regular season, then a single-elimination tournament.</p><p class="m-meta">Majors: Founder\'s Cup, Summer Smash, GP Open, End-of-Year Championship.</p>') +
      sec('Leagues', '<ul><li><b>Premier</b> (20): top 14 make the tournament, top 2 seeds get a bye, bottom 6 relegated. Payouts $40 / $20 / $10.</li><li><b>B-League</b> (20): top 14 play a promotion tournament. Regular-season winner is auto-promoted plus the top 5 other tournament finishers. Payouts $20 / $10 / $5.</li><li><b>The Nest</b>: format varies. Payouts $15 / $10 / $5.</li></ul>') +
      sec('Playing a match', '<ol><li>Matches are played over iMessage.</li><li>The <b>Home</b> player sends first and labels it official.</li><li>The <b>Away</b> player must play back by the send/start deadline (48 hours before the week deadline).</li><li>Every later turn within 24 hours.</li><li>Missing a time limit is a forfeit.</li></ol>') +
      sec('Tournament', '<p>Best-of-majority series. Higher seed gets home advantage. Draws are replayed.</p>') +
      sec('Scoring & tiebreaks', '<p>Win 3 · Draw 1 · Loss 0. Ties: win % (draw = half a win), then head-to-head, then a best-of-3.</p>') +
      sec('Reporting results', '<p><b>Today:</b> the winner posts "@A beat @B in [Game]" in Discord within 24 hours.</p><p><b>Proposed:</b> the winner taps Report result, the opponent confirms. Disputes go to an arbiter.</p>') +
      sec('Conduct, disputes, forfeits detail, payouts timing', '<p class="note">To be filled from the official doc.</p>');
  };

  P.belts = function () {
    var r = GPBL.rng(7), pool = L.premier.cfg.players.slice(0, 11);
    return '<h1>Title Belts</h1><p class="sub">Win a match against the holder in that game to take the belt.</p><div class="note">Holders and defenses below are SAMPLE data.</div><div class="grid two">' + D.belts.map(function (b) {
      var h = pool[Math.floor(r() * pool.length)], d = 1 + Math.floor(r() * 6);
      return '<div class="card trophy"><div class="ico" style="background:linear-gradient(135deg,#e8b23a,#a8451a);color:#1c120b">' + esc(b[0].slice(0, 2).toUpperCase()) + '</div><div><h3>' + esc(b[1]) + '</h3><p class="m-meta">Holder: <b style="color:var(--ink)">' + esc(h) + '</b> · ' + d + ' defense' + (d > 1 ? 's' : '') + '</p></div></div>';
    }).join('') + '</div>';
  };

  var TROPHIES = [['SC', 'Season Champion', 'Won a monthly tournament'], ['RS', 'Regular Season Title', 'Finished 1st in the regular season'], ['MJ', 'Major Winner', 'Founder\'s Cup, Summer Smash, GP Open or EOY Championship'], ['BT', 'Belt Holder', 'Held a title belt'], ['PR', 'Promotion', 'Promoted from B-League']];
  P.trophies = function () {
    var r = GPBL.rng(11), names = ['Julian Mina', 'Jacob Jensen', 'Trevor Busenitz', 'Bryce Garrell', 'Chris McCroskey'];
    return '<h1>The Trophy Room</h1><p class="sub">Every trophy has a symbol and a meaning, instead of a string of emoji.</p><h2>Legend</h2><div class="grid two">' + TROPHIES.map(function (t) { return '<div class="card trophy"><div class="ico">' + t[0] + '</div><div><h3>' + t[1] + '</h3><p class="m-meta">' + t[2] + '</p></div></div>'; }).join('') + '</div>' +
      '<h2>Cabinets</h2><div class="note">Counts are SAMPLE data until filled in from the current Trophy Room.</div><div class="card"><ul class="list">' + names.map(function (n) { return '<li><b>' + esc(n) + '</b><span class="row" style="gap:6px">' + TROPHIES.map(function (t) { var c = Math.floor(r() * 4); return c ? '<span class="pill" title="' + t[1] + '">' + t[0] + ' ×' + c + '</span>' : ''; }).join('') + '</span></li>'; }).join('') + '</ul></div>';
  };

  P.records = function () {
    var tbl = function (rows) { return '<div class="card" style="padding:8px"><table><thead><tr><th>#</th><th>Player</th><th>W</th><th>L</th><th>D</th><th>Pts</th><th>Win%</th></tr></thead><tbody>' + rows.map(function (x, i) { return '<tr><td class="rk">' + (i + 1) + '</td><td>' + esc(x[0]) + '</td><td>' + x[1] + '</td><td>' + x[2] + '</td><td>' + x[3] + '</td><td>' + (x[4] || '–') + '</td><td>' + (x[5] || '–') + '</td></tr>'; }).join('') + '</tbody></table></div>'; };
    return '<h1>Hall of Records</h1><p class="sub">Real figures from the current site (top 3 shown).</p><div class="grid three">' + D.records.map(function (x) { return '<div class="card"><p class="m-meta">' + esc(x[0]) + '</p><h3 style="font:900 22px var(--px);color:var(--gold)">' + esc(x[1]) + '</h3><p>' + esc(x[2]) + '</p></div>'; }).join('') + '</div><h2>All-time</h2>' + tbl(D.allTime) + '<h2>2026</h2>' + tbl(D.year2026);
  };

  P.archive = function () { return '<h1>Archive</h1><p class="sub">Past seasons. In the full version each would open its final standings and bracket.</p><div class="grid two">' + ['GPBL 2022', 'GPBL 2023', 'WGPBL', 'B-League'].map(function (a) { return '<div class="card"><h3>' + a + '</h3><p class="m-meta">To be imported from the existing archive sheets.</p></div>'; }).join('') + '</div>'; };
  P.fit = function () { return '<h1>Fit Pigeon</h1><p class="sub">The league\'s side competition.</p><div class="grid three"><div class="card"><h3>Leaderboard</h3><p class="m-meta">To be imported from the current sheet.</p></div><div class="card"><h3>Scorecard</h3><p class="m-meta">Log entries here instead of a shared sheet.</p></div><div class="card"><h3>Cheat Sheet</h3><p class="m-meta">How points are earned. To be filled from the current doc.</p></div></div>'; };
  P.merch = function () { return '<h1>Merch</h1><div class="card trophy"><div class="ico" style="width:80px;height:80px"><img src="icon.svg" alt="" style="width:64px;image-rendering:pixelated"></div><div><h3>GPBL die-cut sticker</h3><p class="m-meta">3×3 inch, pixel pigeon.</p><a class="btn sm" href="' + D.links.merchForm + '" target="_blank" rel="noopener">Order (Google Form)</a></div></div>'; };
  P.about = function () { return '<h1>About</h1><div class="card"><p style="font:700 18px var(--px);color:var(--gold)">"To connect the disconnected, utilizing the power of the Pigeon."</p></div><h2>The team</h2><div class="grid two">' + D.team.map(function (t) { return '<div class="card trophy"><div class="ico">' + t[0].split(' ').map(function (w) { return w[0]; }).join('') + '</div><div><h3>' + esc(t[0]) + '</h3><p class="m-meta">' + esc(t[1]) + '</p></div></div>'; }).join('') + '</div><h2>Find us</h2><div class="row"><a class="btn ghost" href="' + D.links.instagram + '" target="_blank" rel="noopener">Instagram</a><a class="btn ghost" href="' + D.links.discord + '">Discord (link TBD)</a><a class="btn ghost" href="' + D.links.youtube + '">YouTube (link TBD)</a><a class="btn ghost" href="mailto:' + D.links.email + '">Email</a></div>'; };
  P.join = function () {
    var f = function (id, l, t) { return '<label for="' + id + '">' + l + '</label><input id="' + id + '" type="' + (t || 'text') + '" autocomplete="off">'; };
    return '<h1>Join the League</h1><p class="sub">$5 a season. Monthly play, real payouts.</p><div class="note">DEMO FORM: nothing is sent or stored.</div><form class="card" id="joinForm">' + f('jn', 'Full name') + f('jp', 'Phone', 'tel') + f('je', 'Email', 'email') + f('ji', 'Who invited you?') +
      '<label>Do you have an iPhone?</label><select><option>Yes</option><option>No</option></select><label>Are you 18+?</label><select><option>Yes</option><option>No</option></select><label for="jw">Why do you want to compete? What\'s your competitive edge (one sentence)?</label><textarea id="jw" rows="3"></textarea><div style="height:14px"></div><button class="btn" style="width:100%">Submit (demo)</button></form>';
  };
  P.proposal = function () {
    var item = function (a, b, c) { return '<div class="card"><h3>' + a + '</h3><p class="m-meta"><b>Today:</b> ' + b + '</p><p><b>Proposed:</b> ' + c + '</p></div>'; };
    return '<h1>Proposal for the executives</h1><p class="sub">A faster, phone-first GPBL site. This is a working prototype with sample data.</p>' +
      item('Results', 'Winner posts in Discord, then an exec retypes it into a sheet.', 'Winner taps Report result. The opponent confirms. Standings update instantly. Disputes land in an exec queue with resolve/override.') +
      item('Schedules', 'A wide round-robin grid in an embedded sheet that double-scrolls on phones.', '"My next match" shows your opponent, home/away and both deadlines with a countdown. Schedules are generated automatically for every league.') +
      item('Standings & tournament', 'Hand-maintained tables.', 'Points, win %, head-to-head, streaks, cut lines, relegation and the bracket all compute from results.') +
      item('Privacy', 'The whole workbook is public, including ADMIN, TEST and "Ignore for now" tabs.', 'Only public views are published. Admin data stays behind exec logins.') +
      item('Look & feel', 'Embedded sheets and emoji strings.', 'One pixel-pigeon autumn brand, a native rulebook, trophy legend, belts and records pages, installable to the Home Screen.') +
      '<h2>What it would take</h2><div class="card"><ol><li>Free static hosting (e.g. GitHub Pages or Netlify).</li><li>A small shared database with logins (e.g. Supabase) so results are shared, not per-device.</li><li>Exec roles for overrides and dispute resolution.</li><li>Optional Discord bot/webhook: post confirmed results and deadline reminders automatically.</li><li>One-time import of rosters, history and records from the current sheets.</li></ol></div>' +
      (MODE === 'live' ? '' : '<div class="card"><h3>Demo controls</h3><p class="m-meta">Resets all sample results on this device.</p><button class="btn red" data-act="reset">Reset demo</button></div>');
  };
  P.more = function () { return '<h1>More</h1>' + NAV.map(function (g) { return '<h2>' + g[0] + '</h2><div class="card"><ul class="list">' + g[1].map(function (x) { return '<li><a href="#/' + x[0] + '">' + x[1] + '</a><span>›</span></li>'; }).join('') + '</ul></div>'; }).join(''); };

  // ---------- report sheet ----------
  function report(mid, forceExec) {
    var m, l; Object.keys(L).forEach(function (k) { L[k].sched.forEach(function (x) { if (x.id === mid) { m = x; l = L[k]; } }); });
    var sel = { winner: null, game: D.games[0] }, ex = (forceExec || state.exec) && (MODE !== 'live' || ME.role === 'exec');
    var el = document.createElement('div'); el.className = 'sheet';
    function draw() {
      el.innerHTML = '<div class="card" role="dialog" aria-label="Report result"><h3>' + (ex ? 'Set result (executive)' : 'Report result') + '</h3><p class="m-meta">' + esc(l.names[m.home]) + ' (H) vs ' + esc(l.names[m.away]) + ' (A)</p><div class="choice">' +
        [m.home, m.away, 'draw'].map(function (w) { return '<button data-w="' + w + '" class="' + (sel.winner === w ? 'on' : '') + '">' + (w === 'draw' ? 'Draw' : esc(l.names[w]) + ' won') + '</button>'; }).join('') +
        '</div><label for="gm">Game played</label><select id="gm">' + D.games.map(function (g) { return '<option' + (g === sel.game ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select><div class="row" style="margin-top:16px"><button class="btn" data-go ' + (sel.winner ? '' : 'disabled style="opacity:.5"') + '>' + (ex ? 'Save as final' : 'Submit for confirmation') + '</button><button class="btn ghost" data-x>Cancel</button></div></div>';
    }
    draw(); document.body.appendChild(el);
    el.addEventListener('change', function (e) { if (e.target.id === 'gm') sel.game = e.target.value; });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (e.target === el || (b && b.hasAttribute('data-x'))) return el.remove();
      if (!b) return; if (b.dataset.w) { sel.winner = b.dataset.w; draw(); }
      if (b.hasAttribute('data-go') && sel.winner && MODE === 'live') { el.remove(); liveDo(ex ? 'exec_set_result' : 'report_result', { p_match: mid, p_winner: sel.winner, p_game: sel.game }, ex ? 'Result saved' : 'Sent to opponent to confirm'); return; }
      if (b.hasAttribute('data-go') && sel.winner) { state.results[mid] = { winner: sel.winner, game: sel.game, status: ex ? 'resolved' : 'pending', by: ex ? 'exec' : state.me, at: now() }; save(); el.remove(); toast(ex ? 'Result saved' : 'Sent to opponent to confirm'); render(); }
    });
  }
  function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-league],[data-week],[data-act]'); if (!a || a.closest('.sheet')) return;
    if (a.dataset.league) { state.league = a.dataset.league; save(); if (a.tagName === 'BUTTON') render(); return; }
    if (a.dataset.week) { state.week = +a.dataset.week; render(); return; }
    var act = a.dataset.act, id = a.dataset.id;
    if (act === 'report') report(id);
    else if (act === 'resolve') report(id, true);
    else if (MODE === 'live' && (act === 'confirm' || act === 'dispute')) liveDo('respond_result', { p_match: id, p_confirm: act === 'confirm' }, act === 'confirm' ? 'Confirmed. Standings updated.' : 'Sent to arbiters');
    else if (act === 'magic') { var em = (document.getElementById('email') || {}).value || ''; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast('Enter a valid email'); a.disabled = true; LIVE.sendMagicLink(em.trim(), location.origin + location.pathname).then(function () { toast('Check your email for the sign-in link'); }, function (e) { a.disabled = false; toast('Could not send: ' + e.message); }); }
    else if (act === 'signout') { LIVE.signOut().then(function () { ME = { role: 'anon' }; state.exec = false; render(); }); }
    else if (act === 'claim') { var pid = (document.getElementById('claimSel') || {}).value; if (pid) liveDo('request_claim', { p_player: pid }, 'Claim sent. An executive will approve it.'); }
    else if (act === 'decide') liveDo('exec_decide_claim', { p_claim: id, p_approve: a.dataset.ok === '1' }, a.dataset.ok === '1' ? 'Approved' : 'Rejected');
    else if (act === 'confirm') { state.results[id].status = 'confirmed'; save(); toast('Confirmed. Standings updated.'); render(); }
    else if (act === 'dispute') { state.results[id].status = 'disputed'; save(); toast('Sent to arbiters'); render(); }
    else if (act === 'exec') { state.exec = !state.exec; save(); render(); }
    else if (act === 'reset') { localStorage.removeItem(KEY); load(); toast('Demo reset'); render(); }
  });
  document.addEventListener('change', function (e) { if (e.target.id === 'me') { state.me = e.target.value; state.league = leagueOf(state.me).key; save(); render(); } });
  document.addEventListener('submit', function (e) { e.preventDefault(); toast('Demo only: nothing was sent'); });
  setInterval(function () { document.querySelectorAll('[data-cd]').forEach(function (c) { c.outerHTML = countdown(+c.dataset.cd); }); }, 1000);

  // ---------- live mode (Supabase) ----------
  function accountHtml() {
    if (MODE !== 'live') return '<div class="card"><h3>Demo mode</h3><p class="m-meta">' + (MODE === 'offline' ? 'The league server could not be reached, so this is the offline demo with sample data.' : 'Sign-in turns on when the site is connected to the league server.') + '</p></div>';
    if (!LIVE.signedIn()) return '<div class="card"><h3>Sign in</h3><p class="m-meta">We email you a one-time sign-in link. No password.</p><label for="email">Email</label><input id="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"><div style="height:12px"></div><button class="btn" data-act="magic">Email me a link</button></div>';
    var h = '<div class="card"><h3>Signed in</h3><p class="m-meta">Role: ' + esc(ME.role) + (ME.player_id ? ' · Player: <b style="color:var(--ink)">' + esc(nameOf(ME.player_id)) + '</b>' : '') + '</p><button class="btn ghost sm" data-act="signout">Sign out</button></div>';
    if (!ME.player_id) {
      var c = ME.claim;
      h += '<div class="card"><h3>Claim your player</h3>' + (c && c.status === 'pending' ? '<div class="note">Waiting for an executive to approve your claim on ' + esc(nameOf(c.player_id)) + '.</div>' : c && c.status === 'rejected' ? '<div class="note">Your claim on ' + esc(nameOf(c.player_id)) + ' was not approved. Pick again or ask an exec.</div>' : '<p class="m-meta">Pick your name. An executive approves it once, then you can report results.</p>') +
        '<label for="claimSel">I am</label><select id="claimSel">' + Object.keys(L).map(function (k) { return '<optgroup label="' + esc(L[k].cfg.name) + '">' + L[k].ids.map(function (id) { return '<option value="' + id + '">' + esc(L[k].names[id]) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select><div style="height:12px"></div><button class="btn" data-act="claim">Request claim</button></div>';
    }
    return h;
  }
  P.account = function () { return '<h1>Account</h1>' + accountHtml(); };
  P.exec = function () {
    if (MODE !== 'live' || ME.role !== 'exec') return '<h1>Executives</h1><div class="card empty">Executives only. ' + (MODE === 'live' ? '' : 'Available when connected to the league server.') + '</div>';
    LIVE.rpc('exec_pending_claims').then(function (rows) { var el = document.getElementById('claims'); if (el) el.innerHTML = rows.length ? '<ul class="list">' + rows.map(function (c) { return '<li><span><b>' + esc(c.player_name) + '</b><br><span class="m-meta">' + esc(c.email || '') + '</span></span><span class="row"><button class="btn green sm" data-act="decide" data-ok="1" data-id="' + esc(c.id) + '">Approve</button><button class="btn red sm" data-act="decide" data-ok="0" data-id="' + esc(c.id) + '">Reject</button></span></li>'; }).join('') + '</ul>' : '<p class="empty">No pending claims.</p>'; }, function (e) { toast(e.message); });
    var disputed = Object.keys(state.results).filter(function (k) { return state.results[k].status === 'disputed'; });
    return '<h1>Executives</h1><h2>Player claims</h2><div class="card" id="claims"><p class="empty">Loading…</p></div><h2>Disputed results</h2><div class="card">' + (disputed.length ? '<ul class="list">' + disputed.map(function (id) { var m = findMatch(id); return '<li><span>' + nm(m.home) + ' vs ' + nm(m.away) + '</span><button class="btn sm" data-act="resolve" data-id="' + id + '">Resolve</button></li>'; }).join('') + '</ul>' : '<p class="empty">None.</p>') + '</div><p class="m-meta">Resolve saves the result as final.</p>';
  };
  function findMatch(id) { var f; Object.keys(L).forEach(function (k) { L[k].sched.forEach(function (m) { if (m.id === id) f = m; }); }); return f; }
  function liveDo(fn, args, msg) { LIVE.rpc(fn, args).then(function () { toast(msg); return pull(true); }, function (e) { toast('Not saved: ' + e.message); }); }
  function pull(force) {
    return Promise.all([LIVE.loadResults(), LIVE.whoami()]).then(function (x) {
      state.results = GPBL_LIVE.toResultMap(x[0]); ME = x[1] || { role: 'anon' }; setBanner();
      var busy = document.querySelector('.sheet') || (document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      if (force || !busy) render();
    }, function (e) { console.warn('poll failed', e.message); });
  }
  function setBanner() {
    var b = document.querySelector('.demo-banner'); if (!b) return;
    b.textContent = MODE === 'live' ? 'LIVE PREVIEW · shared results · roster and schedule are SAMPLE data · not the official league site' + (ME.role === 'exec' ? ' · EXEC' : '')
      : MODE === 'offline' ? 'OFFLINE DEMO · league server unreachable · sample data · results save only on this device'
      : 'DEMO PREVIEW · sample data · not the official league site · results save only on this device';
    b.style.background = MODE === 'live' ? 'var(--green)' : MODE === 'offline' ? 'var(--red)' : '';
  }
  async function boot() {
    if (!window.GPBL_LIVE || !GPBL_LIVE.isConfigured(CFG)) { MODE = 'demo'; setBanner(); render(); return; }
    LIVE = GPBL_LIVE.Client(CFG, localStorage);
    var a = LIVE.adoptHash(location.hash);
    if (a) history.replaceState(null, '', location.pathname + location.search + (a.error ? '#/account' : '#/match'));
    $app.innerHTML = '<div class="card empty">Connecting to the league server…</div>';
    try {
      var st = await LIVE.loadStatic();
      L = GPBL_LIVE.toLeagues(st.players, st.matches, D.leagues);
      WEEKS = st.weeks.map(function (w) { return { week: w.week, start: new Date(w.start_at), end: new Date(w.finish_by), sendBy: new Date(w.send_by) }; });
      S.label = st.season.label;
      state.results = GPBL_LIVE.toResultMap(await LIVE.loadResults());
      ME = await LIVE.whoami(); state.exec = false; MODE = 'live';
      if (ME.player_id) { state.me = ME.player_id; state.league = leagueOf(ME.player_id).key; }
      if (!L[state.league] || !L[state.league].ids.length) state.league = 'premier';
      if (!leagueOf(state.me) || !leagueOf(state.me).names[state.me]) state.me = L.premier.ids[0];
    } catch (e) { console.warn('Live mode unavailable, using offline demo:', e.message); MODE = 'offline'; load(); }
    setBanner(); render(); if (a && a.error) toast('Sign-in failed: ' + a.error);
    if (MODE === 'live') POLL = setInterval(pull, CFG.POLL_MS || 20000);
  }

  function route() { return (location.hash.replace(/^#\/?/, '') || '').split('?')[0]; }
  function render() {
    var r = route(); if (!P[r]) r = '';
    $app.innerHTML = P[r]() + '<footer>GPBL prototype · sample data · <a href="#/proposal">about this redesign</a></footer>';
    document.getElementById('tabbar').innerHTML = TABS.map(function (t) { return '<a href="#/' + t[0] + '" class="' + (t[0] === r || (t[0] === 'more' && !TABS.some(function (x) { return x[0] === r; })) ? 'on' : '') + '"><b>' + t[1] + '</b>' + t[2] + '</a>'; }).join('');
    drawer.innerHTML = '<button class="menu-btn close" aria-label="Close">✕</button>' + NAV.map(function (g) { return '<h4>' + g[0] + '</h4>' + g[1].map(function (x) { return '<a href="#/' + x[0] + '" class="' + (x[0] === r ? 'on' : '') + '">' + x[1] + '</a>'; }).join(''); }).join('');
  }
  var last = route();
  window.addEventListener('hashchange', function () { if (route() !== last) { last = route(); window.scrollTo(0, 0); } render(); });
  boot();
})();
