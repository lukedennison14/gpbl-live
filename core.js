/* GPBL core logic: schedule, standings, bracket. Works in browser (window.GPBL) and Node (require). */
(function (root) {
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Week windows from the published pattern: 4 weeks of ~4 days; week ends 8:59p ET; send/start deadline 48h before.
  // offset: ET UTC offset string for the month (e.g. "-05:00" for November after DST ends).
  function weekWindows(year, month, offset) {
    offset = offset || '-05:00';
    var p = function (n) { return String(n).padStart(2, '0'); };
    var at = function (d, h, m) { return new Date(year + '-' + p(month) + '-' + p(d) + 'T' + p(h) + ':' + p(m) + ':00' + offset); };
    var out = [];
    for (var i = 0; i < 4; i++) {
      var start = i === 0 ? at(1, 0, 0) : at(1 + 4 * i, 21, 0);
      var end = at(5 + 4 * i, 20, 59);
      out.push({ week: i + 1, start: start, end: end, sendBy: new Date(end.getTime() + 60000 - 48 * 3600e3) });
    }
    return out;
  }
  // Circle-method round robin; spreads rounds over weeks; alternates home/away.
  function roundRobin(ids, weeks) {
    var list = ids.slice(); if (list.length % 2) list.push(null);
    var n = list.length, rounds = n - 1, matches = [];
    for (var r = 0; r < rounds; r++) {
      for (var i = 0; i < n / 2; i++) {
        var a = list[i], b = list[n - 1 - i]; if (a === null || b === null) continue;
        var swap = i === 0 ? r % 2 === 1 : i % 2 === 1; var home = swap ? b : a, away = swap ? a : b;
        var w = weeks[Math.min(weeks.length - 1, Math.floor(r * weeks.length / rounds))];
        matches.push({ id: 'r' + (r + 1) + 'm' + (i + 1), round: r + 1, week: w.week, home: home, away: away, sendBy: w.sendBy, finishBy: w.end });
      }
      list.splice(1, 0, list.pop());
    }
    return matches;
  }
  function counts(results) { return results.filter(function (r) { return r && (r.status === 'confirmed' || r.status === 'resolved'); }); }
  // results: [{home, away, winner: id|'draw', status, at}]
  function standings(ids, results) {
    var done = counts(results), t = {};
    ids.forEach(function (id) { t[id] = { id: id, w: 0, l: 0, d: 0, gp: 0, pts: 0, pct: 0, seq: [] }; });
    done.slice().sort(function (a, b) { return (a.at || 0) - (b.at || 0); }).forEach(function (r) {
      var A = t[r.home], B = t[r.away]; if (!A || !B) return;
      A.gp++; B.gp++;
      if (r.winner === 'draw') { A.d++; B.d++; A.pts++; B.pts++; A.seq.push('D'); B.seq.push('D'); }
      else { var W = t[r.winner], L = r.winner === r.home ? B : A; W.w++; L.l++; W.pts += 3; W.seq.push('W'); L.seq.push('L'); }
    });
    var rows = ids.map(function (id) { var x = t[id]; x.pct = x.gp ? (x.w + 0.5 * x.d) / x.gp : 0; x.streak = streak(x.seq); delete x.seq; return x; });
    function h2h(a, b) { var s = 0; done.forEach(function (r) { if ((r.home === a && r.away === b) || (r.home === b && r.away === a)) { if (r.winner === a) s++; else if (r.winner === b) s--; } }); return s; }
    rows.sort(function (a, b) {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.pct !== a.pct) return b.pct - a.pct;
      var h = h2h(a.id, b.id); if (h) { a.tb = b.tb = 'head-to-head'; return -h; }
      if (a.gp) a.tb = b.tb = 'best-of-3 playoff needed';
      return 0;
    });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }
  function streak(seq) { if (!seq.length) return '-'; var last = seq[seq.length - 1], n = 0; for (var i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++; return last + n; }
  // Single elimination for top N seeds; top `byes` seeds skip round 1.
  function bracket(seeds, byes) {
    var n = seeds.length, size = 1; while (size < n) size *= 2;
    var order = [1, 2]; while (order.length < size) { var m = order.length * 2 + 1, nx = []; order.forEach(function (s) { nx.push(s, m - s); }); order = nx; }
    var r1 = []; for (var i = 0; i < order.length; i += 2) r1.push([order[i], order[i + 1]].map(function (s) { return s <= n ? { seed: s, id: seeds[s - 1] } : null; }));
    return { size: size, round1: r1, byes: seeds.slice(0, size - n) };
  }
  var api = { rng: rng, weekWindows: weekWindows, roundRobin: roundRobin, standings: standings, bracket: bracket, streak: streak };
  if (typeof module !== 'undefined') module.exports = api; else root.GPBL = api;
})(this);
