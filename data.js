/* Demo data. Names come from the public GPBL site; which league each person is in, all schedules and all results are SAMPLE data invented for this prototype. */
var GPBL_DATA = {
  season: { label: 'November 2026', year: 2026, month: 11, offset: '-05:00', demoNow: '2026-11-09T12:00:00-05:00' },
  games: ['8 Ball (hard)', 'Basketball', 'Archery', 'Word Bites', 'Darts 301', 'Darts 201', 'Darts 101', 'Cup Pong', 'Mini Golf (3 hole)', 'Mini Golf (5 hole)', 'Knockout', 'Shuffleboard', '9 Ball (hard)'],
  leagues: {
    premier: { name: 'Premier League', short: 'Premier', cut: 14, byes: 2, relegate: 6, payout: ['$40', '$20', '$10'],
      players: ['Julian Mina', 'Jacob Jensen', 'Chris McCroskey', 'Freddy Sanchez', 'Evan Scarborough', 'Trevor Busenitz', 'Bryce Garrell', 'Dalton Lansdowne', 'Jake Eads', 'Johnathan Foster', 'Colin Reis'] },
    b: { name: 'B-League', short: 'B-League', cut: 14, byes: 2, promote: 'Regular-season winner + top 5 other tournament finishers promoted', payout: ['$20', '$10', '$5'],
      players: ['Colby Vollmer', 'Tit Davis', 'Marshall Wicker', 'Colin Dral'] },
    nest: { name: 'C-League "The Nest"', short: 'The Nest', cut: 8, byes: 0, payout: ['$15', '$10', '$5'], players: [] }
  },
  team: [['Johnathan Foster', 'Commissioner / Founder'], ['Jacob Jensen', 'League Arbiter / Co-Founder'], ['Colin Reis', 'Deputy Commissioner'], ['Tit Davis', 'B-League Commissioner'], ['Colby Vollmer', 'B-League Deputy Commissioner'], ['Julian Mina', 'League Arbiter'], ['Marshall Wicker', 'IT Expert'], ['Colin Dral', 'IT Expert']],
  belts: [['Word Bites', 'Bites Belt'], ['8 Ball', '8Ball Belt'], ['Knockout', 'KO Belt'], ['Mini Golf', 'Mini Belt'], ['Cup Pong', 'Cup Pong Belt']],
  allTime: [['Jacob Jensen', 578, 318, 49, 1783, '61.16%'], ['Julian Mina', 574, 176, 34, 1756, '73.21%'], ['Chris McCroskey', 532, 334, 58, null, null]],
  year2026: [['Julian Mina', 151, 35, 10, 463, '77.04%'], ['Freddy Sanchez', 132, 58, 6, 402, null], ['Evan Scarborough', 127, 61, 8, 389, null]],
  records: [['Best Season Record', '25-2-1 · 91.07% · 76 pts', 'Chris McCroskey (Nov 2023) and Julian Mina (Jan 2024)'], ['Longest Win Streak', '19 wins', 'Julian Mina'], ['Best Start', '13-0', 'Dalton Lansdowne']],
  links: { instagram: 'https://www.instagram.com/gamepigeonbattleleague/', email: 'gamepigeonbattleleague@gmail.com', discord: '#discord-link-needed', youtube: '#youtube-link-needed', merchForm: 'https://forms.gle/BXxkfwkzWg2DSkkH9', rulebook: 'https://docs.google.com/document/d/e/2PACX-1vRChjIarV5HeUGoNMz2iWeAld3-qs1ZpOyhqZuvL9tmghuHm_rsFoD3Px4kHE9JoBMguGhjvjBMZyLv/pub' }
};
(function () { var n = 1; Object.keys(GPBL_DATA.leagues).forEach(function (k) { var p = GPBL_DATA.leagues[k].players; while (p.length < 20) p.push('Sample Player ' + (n++)); }); })();
