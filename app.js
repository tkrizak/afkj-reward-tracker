let showOverallLost = false;
let showSeasonLost = false;

// In-game item icon paths
const REWARD_ICONS = {
  tidal: 'images/Item_Tidal_Essence.webp',
  temporal: 'images/Item_Temporal_Essence.webp',
  twilight: 'images/Item_Twilight_Essence.webp',
  dreamFragment: 'images/Item_Dream_Fragment.webp',
  seasonToken: 'images/Item_Season_Token.webp',
  diamonds: 'images/Item_Diamond.webp',
  slumber: 'images/Item_Slumber_Essence.webp',
  stellar: 'images/Item_Stellar_Crystal.webp',
};

// Display order: non-essences on the first row, essences on the second
// (Slumber sits with the other essences, after Twilight).
const CURRENCIES = {
  dreamFragment: {
    name: 'Dream Fragment',
    icon: REWARD_ICONS.dreamFragment,
    type: 'dreamFragment',
  },
  seasonToken: {
    name: 'Season Token',
    icon: REWARD_ICONS.seasonToken,
    type: 'seasonToken',
  },
  diamonds: {
    name: 'Diamonds',
    icon: REWARD_ICONS.diamonds,
    type: 'diamonds',
  },
  stellarCrystal: {
    name: 'Stellar Crystal',
    icon: REWARD_ICONS.stellar,
    type: 'stellar',
  },
  tidalEssence: {
    name: 'Tidal Essence',
    icon: REWARD_ICONS.tidal,
    type: 'tidal',
  },
  temporalEssence: {
    name: 'Temporal Essence',
    icon: REWARD_ICONS.temporal,
    type: 'temporal',
  },
  twilightEssence: {
    name: 'Twilight Essence',
    icon: REWARD_ICONS.twilight,
    type: 'twilight',
  },
  slumberEssence: {
    name: 'Slumber Essence',
    icon: REWARD_ICONS.slumber,
    type: 'slumber',
  },
};
const MISC_CURRENCY_KEYS = [
  'dreamFragment',
  'seasonToken',
  'diamonds',
  'stellarCrystal',
];
const ESSENCE_CURRENCY_KEYS = [
  'tidalEssence',
  'temporalEssence',
  'twilightEssence',
  'slumberEssence',
];
const CURRENCY_KEYS = [...MISC_CURRENCY_KEYS, ...ESSENCE_CURRENCY_KEYS];

const renderItemBadge = (currencyObj) => {
  const iconHtml = currencyObj.icon
    ? `<img src="${currencyObj.icon}" class="item-card-icon" alt="${currencyObj.name}" title="${currencyObj.name}" />`
    : `<span class="item-card-placeholder">${currencyObj.placeholder || 'ITEM'}</span>`;

  return `<div class="item-card-preview ${currencyObj.type || ''}" title="${currencyObj.name}">
    ${iconHtml}
  </div>`;
};

// ONE BLOCK PER SEASON - the only place to edit when a new season starts.
// Add a block at the end (oldest first). Everything else is derived:
//  - number/name: the "add season" window suggests the newest block
//  - start: the date that season starts; a date is in the season whose
//    block has the latest start on or before it (so any date before the
//    first block is the season before it, e.g. S7 for dates before S8)
//  - cycleStart + bosses: the default boss rotation (the first boss in
//    the list is the boss on cycleStart; players can still edit it)
//  - end (optional): last day of the season. Only needed on the newest
//    block - without it that season is treated as running on until you
//    add the next block. Dates after `end` count as the next season.
// New bosses just go into that season's `bosses` list.
const SEASON_BLOCKS = [
  {
    number: 8,
    name: 'Veil of Memories',
    start: '2026-09-23',
    cycleStart: '2026-09-23',
    bosses: [
      'King Croaker',
      'Novik',
      'Mirage Frostspike',
      'Marshtoad',
      'Doomscourge',
      'Talking Root',
      'Snow Stomper',
      'Midnight Harvester',
    ],
  },
];
const LATEST_SEASON_BLOCK = SEASON_BLOCKS[SEASON_BLOCKS.length - 1];
// Every boss in any season (the "known" bosses), without duplicates
const DREAM_BOSSES = (() => {
  const seen = new Set();
  const out = [];
  SEASON_BLOCKS.forEach((blk) =>
    blk.bosses.forEach((name) => {
      const k = name.trim().replace(/\s+/g, ' ').toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(name);
      }
    }),
  );
  return out;
})();
// Which game season a date is in, from the block start dates
const seasonNumberForDate = (dateStr) => {
  const first = SEASON_BLOCKS[0];
  if (!dateStr || dateStr < first.start) return first.number - 1;
  let blk = first;
  SEASON_BLOCKS.forEach((b) => {
    if (b.start <= dateStr) blk = b;
  });
  if (blk === LATEST_SEASON_BLOCK && blk.end && dateStr > blk.end) {
    return blk.number + 1;
  }
  return blk.number;
};
const BOSS_ROTATIONS_KEY = 'afk_rank_tracker_boss_rotations';

const daysBetween = (a, b) => {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db - da) / 86400000);
};
// Boss names are compared ignoring capitals and extra spaces, so
// "king  croaker" and "King Croaker" are the same boss.
const cleanBoss = (str) =>
  String(str || '')
    .trim()
    .replace(/\s+/g, ' ');
const normBoss = (str) => cleanBoss(str).toLowerCase();

const loadCustomRotations = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(BOSS_ROTATIONS_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
};
const saveCustomRotations = (obj) => {
  try {
    localStorage.setItem(BOSS_ROTATIONS_KEY, JSON.stringify(obj));
  } catch (e) {}
};
// A season uses the default of the block with its number: the number
// typed in its name ("S8", "Season 8"), else the one its start date is in.
const defaultRotationFor = (season) => {
  if (!season) return null;
  const n =
    numberFromName(season.name) ?? seasonNumberForDate(season.start);
  const blk = SEASON_BLOCKS.find((b) => b.number === n);
  return blk ? { anchor: blk.cycleStart, order: [...blk.bosses] } : null;
};
// The player's own rotation wins over the site default; null = not set.
const rotationFor = (season) => {
  if (!season) return null;
  const custom = loadCustomRotations()[season.id];
  if (
    custom &&
    custom.anchor &&
    Array.isArray(custom.order) &&
    custom.order.length
  ) {
    return {
      anchor: custom.anchor,
      order: [...custom.order],
      source: 'custom',
    };
  }
  const def = defaultRotationFor(season);
  return def ? { ...def, source: 'default' } : null;
};
const bossFromRotation = (rot, dateStr) => {
  const n = rot.order.length;
  const delta = daysBetween(rot.anchor, dateStr);
  return rot.order[((delta % n) + n) % n];
};
// Boss for a date from that date's season rotation ('' = not set)
const bossForDate = (dateStr) => {
  if (!dateStr) return '';
  const season = findSeasonForDate(dateStr, loadSeasons());
  const rot = rotationFor(season);
  return rot ? bossFromRotation(rot, dateStr) : '';
};
// Every boss name we know of, so a typed name reuses the spelling
const knownBossNames = () => {
  const names = [...DREAM_BOSSES];
  Object.values(loadCustomRotations()).forEach((r) => {
    if (r && Array.isArray(r.order)) names.push(...r.order);
  });
  try {
    const days = loadDays();
    Object.keys(days).forEach((d) => {
      if (days[d].boss) names.push(days[d].boss);
    });
  } catch (e) {}
  return names;
};

const MODES = {
  drServer: {
    label: 'Dream Realm - Server',
    brackets: [
      {
        min: 1,
        max: 10,
        r: { dreamFragment: 550, tidalEssence: 10, temporalEssence: 4 },
      },
      {
        min: 11,
        max: 20,
        r: { dreamFragment: 450, tidalEssence: 8, temporalEssence: 3 },
      },
      {
        min: 21,
        max: 50,
        r: { dreamFragment: 400, tidalEssence: 6, temporalEssence: 2 },
      },
      {
        min: 51,
        max: 100,
        r: { dreamFragment: 350, tidalEssence: 6, temporalEssence: 1 },
      },
    ],
  },
  drDistrict: {
    label: 'Dream Realm - District',
    brackets: [
      {
        min: 1,
        max: 20,
        r: { temporalEssence: 2, twilightEssence: 4, seasonToken: 215 },
      },
      {
        min: 21,
        max: 50,
        r: { temporalEssence: 2, twilightEssence: 3, seasonToken: 200 },
      },
      {
        min: 51,
        max: 100,
        r: { temporalEssence: 2, twilightEssence: 2, seasonToken: 185 },
      },
      {
        min: 101,
        max: 200,
        r: { temporalEssence: 2, twilightEssence: 2, seasonToken: 170 },
      },
      {
        min: 201,
        max: 500,
        r: { temporalEssence: 2, twilightEssence: 1, seasonToken: 155 },
      },
    ],
  },
  supremeArena: {
    label: 'Supreme Arena',
    brackets: [
      {
        min: 1,
        max: 5,
        r: { twilightEssence: 8, seasonToken: 500, diamonds: 360 },
      },
      {
        min: 6,
        max: 20,
        r: { twilightEssence: 8, seasonToken: 500, diamonds: 360 },
      },
      {
        min: 21,
        max: 50,
        r: { twilightEssence: 6, seasonToken: 450, diamonds: 330 },
      },
      {
        min: 51,
        max: 100,
        r: { twilightEssence: 4, seasonToken: 400, diamonds: 300 },
      },
      {
        min: 101,
        max: 200,
        r: { twilightEssence: 3, seasonToken: 380, diamonds: 280 },
      },
      {
        min: 201,
        max: 500,
        r: { twilightEssence: 2, seasonToken: 340, diamonds: 250 },
      },
    ],
  },
  dreamHunt: {
    label: 'Dream Hunt',
    brackets: [
      {
        min: 1,
        max: 10,
        r: {
          dreamFragment: 200,
          seasonToken: 900,
          twilightEssence: 25,
          slumberEssence: 10,
        },
      },
      {
        min: 11,
        max: 20,
        r: {
          dreamFragment: 180,
          seasonToken: 800,
          twilightEssence: 20,
          slumberEssence: 8,
        },
      },
      {
        min: 21,
        max: 50,
        r: {
          dreamFragment: 160,
          seasonToken: 750,
          twilightEssence: 15,
          slumberEssence: 6,
        },
      },
      {
        min: 51,
        max: 100,
        r: {
          dreamFragment: 150,
          seasonToken: 700,
          twilightEssence: 15,
          slumberEssence: 5,
        },
      },
      {
        min: 101,
        max: 200,
        r: {
          dreamFragment: 140,
          seasonToken: 650,
          twilightEssence: 12,
          slumberEssence: 4,
        },
      },
      {
        min: 201,
        max: 500,
        r: {
          dreamFragment: 120,
          seasonToken: 600,
          twilightEssence: 10,
          slumberEssence: 3,
        },
      },
    ],
  },
  // Supreme League: rewarded roughly once a month, when you are knocked
  // out of the group stage or out of a Swiss round. Group stage exits are
  // stored as 1000 + group rank (or 81 if no group rank was typed), so
  // they always land in the Group stage bracket and never clash with
  // Swiss ranks.
  // Supreme League. Ranks 1-48 are the knockout stage. "Out in swiss
  // stage" is stored as 2000 + rank (rank required) and "Out in group
  // stage" as 1000 + rank (rank required), so the stage never clashes
  // with a knockout rank. (81-999 = group stage exits from older saves.)
  supremeLeague: {
    label: 'Supreme League',
    brackets: [
      {
        min: 1,
        max: 1,
        label: 'Champion',
        r: { slumberEssence: 120, stellarCrystal: 10, seasonToken: 2000 },
      },
      {
        min: 2,
        max: 2,
        label: 'Runner-Up',
        r: { slumberEssence: 120, stellarCrystal: 10, seasonToken: 1800 },
      },
      {
        min: 3,
        max: 3,
        label: '3rd Place',
        r: { slumberEssence: 120, stellarCrystal: 10, seasonToken: 1600 },
      },
      {
        min: 4,
        max: 4,
        label: '4th Place',
        r: { slumberEssence: 120, stellarCrystal: 10, seasonToken: 1500 },
      },
      {
        min: 5,
        max: 8,
        label: 'Top 8',
        r: { slumberEssence: 100, stellarCrystal: 8, seasonToken: 1200 },
      },
      {
        min: 9,
        max: 16,
        label: 'Top 16',
        r: { slumberEssence: 90, stellarCrystal: 6, seasonToken: 1000 },
      },
      {
        min: 17,
        max: 32,
        label: 'Top 32',
        r: { slumberEssence: 80, stellarCrystal: 6, seasonToken: 800 },
      },
      {
        min: 33,
        max: 48,
        label: 'Top 48',
        r: { slumberEssence: 60, stellarCrystal: 5, seasonToken: 800 },
      },
      {
        min: 2000,
        max: 2999,
        label: 'Swiss Stage',
        r: { slumberEssence: 40, stellarCrystal: 4, seasonToken: 800 },
      },
      {
        min: 81,
        max: 1999,
        label: 'Group Stage',
        r: { slumberEssence: 20, stellarCrystal: 3, seasonToken: 800 },
      },
    ],
  },
};

const STORAGE_KEY = 'afk_rank_tracker_days';
const SEASONS_KEY = 'afk_rank_tracker_seasons';
const ACTIVE_SEASON_KEY = 'afk_rank_tracker_active_season';

// Tier-list palette (S → A → B → C → D), top bracket = S
const TIER_COLORS = [
  '#ff8a80', // S - coral red
  '#ffb074', // A - peach orange
  '#ffe066', // B - yellow
  '#fff59d', // C - light yellow
  '#c5e99b', // D - light green
  '#a8d48a', // below D if a 6th tier is needed
];
const tierColorForIndex = (idx, total = 6) => {
  if (idx < 0) return null;
  if (total <= 1) return TIER_COLORS[0];
  // Map this mode's bracket index evenly across S→D
  const ladderMax = Math.min(total, TIER_COLORS.length) - 1;
  const mapped = Math.round((idx / Math.max(total - 1, 1)) * ladderMax);
  return TIER_COLORS[Math.min(mapped, TIER_COLORS.length - 1)];
};

const getBracket = (modeKey, rank) => {
  if (!rank || rank < 1) return null;
  return (
    MODES[modeKey].brackets.find((b) => rank >= b.min && rank <= b.max) ||
    null
  );
};
const getBracketIndex = (modeKey, rank) => {
  if (!rank || rank < 1) return -1;
  return MODES[modeKey].brackets.findIndex(
    (b) => rank >= b.min && rank <= b.max,
  );
};

const bestRewards = (modeKey) => MODES[modeKey].brackets[0].r;

// highest rank that can be typed (a rank is a whole number, 1 or more)
const MAX_RANK_INPUT = 5000;
const SL_GROUP_OFFSET = 1000; // stored rank = 1000 + group stage rank
const SL_SWISS_OFFSET = 2000; // stored rank = 2000 + swiss stage rank
// "Did not qualify": stored as a rank outside every bracket, so it
// counts as a played day with no rewards (everything possible is lost).
const SL_NOQUAL_RANK = 9999999;
// 'ko' (knockout 1-48) | 'swiss' | 'group' | 'dnq'
const slStage = (rank) =>
  rank >= SL_NOQUAL_RANK
    ? 'dnq'
    : rank >= SL_SWISS_OFFSET
      ? 'swiss'
      : rank > 48
        ? 'group'
        : 'ko';
const bracketLabel = (modeKey, b) => {
  if (b.label) return b.label;
  if (b.min === b.max) return `#${b.min}`;
  return b.min === 1 ? `Top ${b.max}` : `${b.min}-${b.max}`;
};
// Text for the history table
const rankText = (modeKey, rank) => {
  if (modeKey !== 'supremeLeague') return `#${rank}`;
  const st = slStage(rank);
  if (st === 'dnq') return 'Did not qualify';
  if (st === 'swiss') {
    return rank > SL_SWISS_OFFSET
      ? `Swiss Stage #${rank - SL_SWISS_OFFSET}`
      : 'Swiss Stage';
  }
  if (st === 'group') {
    return rank > SL_GROUP_OFFSET
      ? `Group Stage #${rank - SL_GROUP_OFFSET}`
      : 'Group Stage';
  }
  return `#${rank}`;
};
// The rank number only; null when there is none (a Supreme League
// swiss/group exit logged without a rank, or did not qualify).
const rankNumText = (modeKey, rank) => {
  if (modeKey !== 'supremeLeague') return `#${rank}`;
  const st = slStage(rank);
  if (st === 'dnq') return null;
  if (st === 'swiss') {
    return rank > SL_SWISS_OFFSET ? `#${rank - SL_SWISS_OFFSET}` : null;
  }
  if (st === 'group') {
    return rank > SL_GROUP_OFFSET ? `#${rank - SL_GROUP_OFFSET}` : null;
  }
  return `#${rank}`;
};
// Modes that only count on some days (not a reward day)
const isModeInactive = (modeKey, dayData) =>
  (modeKey === 'supremeArena' && !!dayData.saOff) ||
  (modeKey === 'dreamHunt' && !dayData.dhRewardDay) ||
  (modeKey === 'supremeLeague' && !dayData.slRewardDay);

const computeLost = (modeKey, rank) => {
  const best = bestRewards(modeKey);
  const bracket = getBracket(modeKey, rank);
  const got = bracket ? bracket.r : {};
  const lost = {};
  Object.keys(best).forEach((c) => {
    lost[c] = best[c] - (got[c] || 0);
  });
  return { bracket, got, lost, best };
};

const loadDays = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const days = raw ? JSON.parse(raw) : {};
    let dirty = false;
    Object.keys(days).forEach((date) => {
      if (days[date].boss === 'Unknown Nightmare') {
        days[date].boss = 'Snow Stomper';
        dirty = true;
      }
      // drop saved ranks that can't be real (negative, 0, decimals, huge):
      // a negative rank would otherwise count as a top rank
      if (days[date].ranks) {
        Object.keys(days[date].ranks).forEach((k) => {
          const r = days[date].ranks[k];
          if (r == null) return;
          const valid =
            Number.isInteger(r) &&
            (k === 'supremeLeague'
              ? (r >= 1 && r <= 48) ||
                (r >= 81 && r <= 2999) ||
                r === SL_NOQUAL_RANK
              : r >= 1 && r <= MAX_RANK_INPUT);
          if (!valid) {
            days[date].ranks[k] = null;
            dirty = true;
          }
        });
      }
      // older saves kept swiss ranks 49-80 as plain numbers
      const oldSl = days[date].ranks && days[date].ranks.supremeLeague;
      if (oldSl >= 49 && oldSl <= 80) {
        days[date].ranks.supremeLeague = SL_SWISS_OFFSET + oldSl;
        dirty = true;
      }
      if (
        days[date].slNoQual &&
        days[date].ranks &&
        !days[date].ranks.supremeLeague
      ) {
        days[date].ranks.supremeLeague = SL_NOQUAL_RANK;
        days[date].slRewardDay = true;
        dirty = true;
      }
    });
    if (dirty) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
      } catch (e) {}
    }
    return days;
  } catch (e) {
    return {};
  }
};
const saveDays = (days) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  } catch (e) {}
};

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const formatDate = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
};

// Log history search: by DATE or BOSS name only (not the season, the
// season day or ranks). Dates can be typed in the usual ways: "oct 18",
// "18 october", "2026-10-18", "18.10.2026", "10/18/2026", "october",
// "2026" ...
const historyDateWords = (dateStr) => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const [y, m, d] = dateStr.split('-');
  const monthIdx = parseInt(m, 10) - 1;
  return [
    dateStr, // 2026-10-18
    `${m}-${d}`, // 10-18
    `${d}-${m}-${y}`, // 18-10-2026
    `${d}.${m}.${y}`, // 18.10.2026
    `${d}/${m}/${y}`, // 18/10/2026
    `${m}/${d}/${y}`, // 10/18/2026
    (MONTHS_SHORT[monthIdx] || '').toLowerCase(), // oct
    (MONTHS_FULL[monthIdx] || '').toLowerCase(), // october
    String(parseInt(d, 10)), // 18
    d, // 18 (05 for the 5th)
    y, // 2026
  ];
};
// Each typed word must match the START of a date word (so "oct" finds
// October, "2026" the year) or be part of the boss name. A short number
// (1-2 digits) means the DAY of the month, so "5" finds the 5th and not
// every date that merely contains a 5.
const historyMatchesQuery = (dateStr, dayData, seasons, q) => {
  if (!q) return true;
  const words = historyDateWords(dateStr);
  const dayWords = dateStr
    ? [dateStr.slice(8, 10), String(+dateStr.slice(8, 10))]
    : [];
  const boss = (
    (dayData && dayData.boss) ||
    bossForDate(dateStr) ||
    ''
  ).toLowerCase();
  const tokens = q
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  return tokens.every((t) =>
    /^\d{1,2}$/.test(t)
      ? dayWords.includes(t)
      : words.some((w) => w.startsWith(t)) || boss.includes(t),
  );
};

const loadSeasons = () => {
  try {
    const raw = localStorage.getItem(SEASONS_KEY);
    if (raw) {
      let list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) {
        let dirty = false;
        // One-time migration: legacy default id "s9" → "s8" / Season 8.
        // Do NOT rewrite user-created seasons by name (that hid new seasons).
        list = list.map((s) => {
          if (s.id === 's9') {
            dirty = true;
            return {
              ...s,
              id: 's8',
              name:
                s.name === 'Season 9' || !s.name ? 'Season 8' : s.name,
              start: s.start || '2026-09-23',
            };
          }
          return s;
        });
        // Replace em/en dashes in saved season names with a plain "-"
        list = list.map((s) => {
          const n = String(s.name || '');
          if (!/[—–]/.test(n)) return s;
          dirty = true;
          return { ...s, name: n.replace(/[—–]/g, '-') };
        });
        // One-time migration: older versions auto-prefixed "S<n> - " at
        // display time. Bake that into the stored name so existing
        // seasons look exactly the same, and store the number.
        list = list.map((s) => {
          if (s.number !== undefined) return s;
          dirty = true;
          const rawName = String(s.name || '').trim();
          const n =
            numberFromName(rawName) ??
            (/^s(\d{1,2})$/i.test(s.id || '')
              ? parseInt(String(s.id).slice(1), 10)
              : null);
          const hasPrefix = /^S\d{1,2}\s*[—–-]/.test(rawName);
          const bare = rawName.replace(/^S\d{1,2}\s*[—–-]\s*/i, '');
          return {
            ...s,
            number: n,
            name: hasPrefix || n == null ? rawName : `S${n} - ${bare}`,
          };
        });
        // Drop accidental duplicate ids (e.g. after older buggy migrations)
        const seen = new Set();
        list = list.filter((s) => {
          if (!s.id || seen.has(s.id)) {
            dirty = true;
            return false;
          }
          seen.add(s.id);
          return true;
        });
        list.sort((a, b) => a.start.localeCompare(b.start));
        if (dirty) saveSeasons(list);
        return list;
      }
    }
  } catch (e) {}
  // First visit: no seasons yet - the person adds the one they want to track.
  return [];
};
const saveSeasons = (list) => {
  try {
    localStorage.setItem(SEASONS_KEY, JSON.stringify(list));
  } catch (e) {}
};
const getActiveSeasonId = () => {
  try {
    return localStorage.getItem(ACTIVE_SEASON_KEY);
  } catch (e) {
    return null;
  }
};
const setActiveSeasonId = (id) => {
  try {
    localStorage.setItem(ACTIVE_SEASON_KEY, id);
  } catch (e) {}
};

const getSeasonDateRange = (seasons, season) => {
  // seasons are sorted by start date; end is day before the next season starts
  const sorted = [...seasons].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const idx = sorted.findIndex((s) => s.id === season.id);
  const start = season.start;
  let end = null;
  if (idx >= 0 && idx < sorted.length - 1) {
    const nextStart = sorted[idx + 1].start;
    // pure YYYY-MM-DD arithmetic - avoid timezone shifts from Date/toISOString
    const d = new Date(nextStart + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    end = d.toISOString().slice(0, 10);
  }
  return { start, end };
};

const getSeasonStatus = (range, today = todayStr()) => {
  if (today < range.start) return 'upcoming';
  if (range.end && today > range.end) return 'ended';
  return 'active';
};

const seasonDurationDays = (range, today = todayStr()) => {
  if (!range.start) return null;
  const endRef = range.end || (today < range.start ? range.start : today);
  const n = daysBetween(range.start, endRef) + 1;
  return n >= 1 ? n : null;
};

const renderSeasonInfoBar = (season, range) => {
  const bar = document.getElementById('seasonInfoBar');
  if (!bar || !season) {
    if (bar) bar.hidden = true;
    return;
  }
  const today = todayStr();
  const status = getSeasonStatus(range, today);
  const statusLabel =
    status === 'active'
      ? 'Active'
      : status === 'ended'
        ? 'Ended'
        : 'Upcoming';
  const statusClass = `season-status ${status}`;
  const startLabel = formatDate(range.start);
  const endLabel = range.end
    ? formatDate(range.end)
    : status === 'active'
      ? 'ongoing'
      : '-';
  const duration = seasonDurationDays(range, today);
  let durationText = '-';
  if (duration != null) {
    if (status === 'active' && !range.end) {
      durationText = `${duration} day${duration === 1 ? '' : 's'} so far`;
    } else {
      durationText = `${duration} day${duration === 1 ? '' : 's'}`;
    }
  }
  const dayNum =
    status === 'active' ? seasonDayNumber(today, range.start) : null;
  // Active season: show the current day in the right-hand slot.
  // Otherwise (ended / upcoming): show the total length there.
  const rightLabel = dayNum != null ? 'Day' : 'Length';
  const rightValue = dayNum != null ? dayNum : durationText;

  bar.hidden = false;
  bar.innerHTML = `
    <span class="${statusClass}">${statusLabel}</span>
    <span>
      <span class="season-info-value">${startLabel}</span>
      <span class="season-info-sep"> → </span>
      <span class="season-info-value">${endLabel}</span>
    </span>
    <span>
      <span class="season-info-label">${rightLabel}</span>
      <span class="season-info-value"> ${rightValue}</span>
    </span>
  `;
};

const dayInSeason = (date, range) => {
  if (date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
};

const seasonDayNumber = (date, seasonStart) => {
  const n = daysBetween(seasonStart, date) + 1;
  return n >= 1 ? n : null;
};

const findSeasonForDate = (date, seasons) => {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const range = getSeasonDateRange(seasons, seasons[i]);
    if (dayInSeason(date, range)) return seasons[i];
  }
  return null;
};

const seasonNumber = (season) => {
  if (!season) return null;
  if (season.number != null && season.number !== '') {
    const n = parseInt(season.number, 10);
    if (n >= 1 && n < 100) return String(n);
  }
  const name = String(season.name || '');
  const fromName = name.match(/\bS(?:eason)?\s*(\d{1,2})\b/i);
  if (fromName) return fromName[1];
  const fromId = String(season.id || '').match(/^s(\d{1,2})$/i);
  if (fromId) return fromId[1];
  return null;
};
// Display name is exactly what the person typed. The season number
// (used for "season N" captions and picking the next number) is tracked
// separately and never injected into the name.
const escapeHtml = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
// season name exactly as typed, in the gold accent colour
const goldName = (name) =>
  `<span style="color: var(--gold)">${escapeHtml(name)}</span>`;
const seasonLabel = (season) => {
  if (!season) return '';
  return String(season.name || '').trim();
};
const numberFromName = (name) => {
  const m = String(name || '').match(/\bS(?:eason)?\s*(\d{1,2})\b/i);
  return m ? parseInt(m[1], 10) : null;
};
const computeBracketDist = (days, dateFilterFn, showLost = false) => {
  const result = {};
  Object.keys(MODES).forEach((modeKey) => {
    const brackets = MODES[modeKey].brackets;
    const counts = brackets.map(() => 0);
    let outside = 0;
    let total = 0;
    const lost = {};
    const gained = {};
    const maxPossible = {};
    const best = bestRewards(modeKey);
    Object.keys(best).forEach((c) => {
      lost[c] = 0;
      gained[c] = 0;
      maxPossible[c] = 0;
    });
    Object.keys(days).forEach((date) => {
      if (dateFilterFn && !dateFilterFn(date)) return;
      // Dream Hunt / Supreme League only count marked reward days
      if (isModeInactive(modeKey, days[date])) return;
      const rank = days[date].ranks[modeKey];
      if (!rank) return;
      total++;
      const idx = getBracketIndex(modeKey, rank);
      if (idx === -1) outside++;
      else counts[idx]++;
      const { lost: dayLost, got: dayGot } = computeLost(modeKey, rank);
      Object.keys(best).forEach((c) => {
        lost[c] += dayLost[c] || 0;
        gained[c] += dayGot[c] || 0;
        maxPossible[c] += best[c];
      });
    });
    result[modeKey] = {
      counts,
      outside,
      total,
      brackets,
      lost,
      gained,
      maxPossible,
    };
  });
  return result;
};

const renderDist = (
  container,
  distData,
  showLost = false,
  scopeLabel = 'this period',
) => {
  const modeKeys = Object.keys(MODES);
  let anyData = false;
  modeKeys.forEach((k) => {
    if (distData[k].total > 0) anyData = true;
  });
  if (!anyData) {
    container.innerHTML = `<div class="empty" style="padding:16px;">No ranks logged yet for ${scopeLabel}.</div>`;
    return;
  }
  container.innerHTML = modeKeys
    .map((modeKey) => {
      const {
        counts,
        outside,
        total,
        brackets,
        lost,
        gained,
        maxPossible,
      } = distData[modeKey];
      if (total === 0) {
        return `<div class="dist-mode">
      <div class="dist-title">${MODES[modeKey].label}</div>
      <div class="dist-empty">No ranks entered</div>
    </div>`;
      }
      const rows = brackets
        .map((b, idx) => {
          const n = counts[idx];
          const pct = Math.round((n / total) * 100);
          const c = tierColorForIndex(idx, brackets.length);
          const label = bracketLabel(modeKey, b);
          return `<div class="dist-row">
        <span class="dist-label" style="color:${c}">${label}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar" style="width:${pct}%;background:${c}"></div>
        </div>
        <span class="dist-pct" style="color:${c}">${pct}%</span>
        <span class="dist-count">${n}/${total}</span>
      </div>`;
        })
        .join('');
      const outPct = Math.round((outside / total) * 100);
      const outRow =
        outside > 0
          ? `<div class="dist-row">
        <span class="dist-label" style="color:var(--red)">${modeKey === 'supremeLeague' ? 'DNQ' : 'Outside'}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar" style="width:${outPct}%;background:var(--red)"></div>
        </div>
        <span class="dist-pct" style="color:var(--red)">${outPct}%</span>
        <span class="dist-count">${outside}/${total}</span>
      </div>`
          : '';

      const curRows = CURRENCY_KEYS.filter(
        (c) => (maxPossible[c] || 0) > 0,
      )
        .map((c) => {
          const cur = CURRENCIES[c];
          const maxVal = maxPossible[c] || 0;
          if (showLost) {
            const lostVal = lost[c] || 0;
            const pct =
              maxVal > 0 ? Math.round((lostVal / maxVal) * 100) : 0;
            const isZero = lostVal === 0;
            const isTotalLoss = pct === 100 && maxVal > 0;
            const lostClass = isZero
              ? 'lost-val zero'
              : isTotalLoss
                ? 'lost-val total-loss-val'
                : 'lost-val';

            const valColor = isZero
              ? 'color:#ffffff; font-weight:800;'
              : isTotalLoss
                ? 'color:var(--red-dark); font-weight:800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
                : 'color:var(--red); font-weight:750;';
            const pctStyle = isZero
              ? 'color:#ffffff; font-weight:800;'
              : isTotalLoss
                ? 'color:var(--red-dark); font-weight:800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
                : 'color:var(--red); font-weight:750;';

            return `<div class="dist-miss-row">
          <span class="dist-miss-name">${renderItemBadge(cur)}</span>
          <span class="dist-miss-nums ${lostClass}">
            <span style="${valColor}">${lostVal.toLocaleString()}</span><span style="color:#ffffff">/${maxVal.toLocaleString()}</span>
            <span class="dist-miss-pct" style="${pctStyle}">(${pct}%)</span>
          </span>
        </div>`;
          } else {
            const gainVal = gained[c] || 0;
            const pct =
              maxVal > 0 ? Math.round((gainVal / maxVal) * 100) : 0;
            const isFull = pct === 100 && maxVal > 0;
            const isZero = gainVal === 0 && maxVal > 0;

            const valColor = isZero
              ? 'color:var(--red); font-weight:800;'
              : isFull
                ? 'color:var(--gold); font-weight:800;'
                : 'color:var(--green-dark); font-weight:750;';
            const pctColor = isZero
              ? 'color:var(--red); font-weight:800;'
              : isFull
                ? 'color:var(--gold); font-weight:800;'
                : 'color:var(--green-dark); font-weight:750;';

            return `<div class="dist-miss-row">
          <span class="dist-miss-name">${renderItemBadge(cur)}</span>
          <span class="dist-miss-nums ${isZero ? 'zero' : ''}">
            <span style="${valColor}">${gainVal.toLocaleString()}</span><span style="color:#ffffff">/${maxVal.toLocaleString()}</span>
            <span class="dist-miss-pct" style="${pctColor}">(${pct}%)</span>
          </span>
        </div>`;
          }
        })
        .join('');

      return `<div class="dist-mode">
      <div class="dist-title">${MODES[modeKey].label}</div>
      <div class="dist-brackets">${rows}${outRow}</div>
      <div class="dist-miss-block">
        ${curRows}
      </div>
    </div>`;
    })
    .join('');
};

let activateSubTab = () => {};
let selectCurrentSeason = () => {};

document.querySelectorAll('.tab').forEach((tab) => {
  tab.onclick = () => {
    document
      .querySelectorAll('.tab')
      .forEach((t) => t.classList.remove('active'));
    document
      .querySelectorAll('.view')
      .forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document
      .getElementById('view-' + tab.dataset.view)
      .classList.add('active');
    if (tab.dataset.view === 'history') renderHistory();
    if (tab.dataset.view === 'overall') {
      activateSubTab('overallSubTabs', 'overallSub-', 'osub', 'totals');
      renderOverall();
    }
    if (tab.dataset.view === 'season') {
      selectCurrentSeason();
      activateSubTab('seasonSubTabs', 'seasonSub-', 'ssub', 'totals');
      renderSeason();
    }
  };
});

const rankInputsEl = document.getElementById('rankInputs');
Object.keys(MODES).forEach((key) => {
  const div = document.createElement('div');
  div.className = 'mode-input';
  let extra = '';
  if (key === 'supremeArena') {
    extra = `<label class="mode-off-row" for="saRewardDay">
      <input type="checkbox" id="saRewardDay" />
      Reward day
    </label>`;
  } else if (key === 'dreamHunt') {
    extra = `<label class="mode-off-row" for="dhRewardDay">
      <input type="checkbox" id="dhRewardDay" />
      Reward day
                </label>`;
  }
  if (key === 'supremeLeague') {
    extra = `<div class="mode-check-row">
      <label class="mode-off-row" for="slRewardDay">
        <input type="checkbox" id="slRewardDay" />
        Reward day
      </label>
      <label class="mode-off-row" for="slNoQual">
        <input type="checkbox" id="slNoQual" />
        Did not qualify
      </label>
    </div>
    <div class="mode-check-row">
      <label class="mode-off-row" for="slKnockoutExit">
        <input type="checkbox" id="slKnockoutExit" />
        Out in Knockout Stage
      </label>
      <label class="mode-off-row" for="slSwissExit">
        <input type="checkbox" id="slSwissExit" />
        Out in Swiss Stage
      </label>
      <label class="mode-off-row" for="slGroupExit">
        <input type="checkbox" id="slGroupExit" />
        Out in Group Stage
      </label>
    </div>
    <div class="mode-hint" id="slHint" hidden></div>`;
  }
  const placeholders = {
    supremeLeague: 'e.g. 12',
    drServer: 'e.g. 12',
    drDistrict: 'e.g. 35',
    supremeArena: 'e.g. 8',
    dreamHunt: 'e.g. 42',
  };
  div.innerHTML = `<label>${MODES[key].label}</label><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" class="tiered" id="rank_${key}" placeholder="${placeholders[key] || 'e.g. 20'}" data-ph="${placeholders[key] || 'e.g. 20'}" />${extra}`;
  // ranks are whole numbers from 1 up: drop minus signs, decimals,
  // letters and leading zeros, and cap very large numbers
  div.querySelector('input.tiered').addEventListener('input', (e) => {
    const el = e.target;
    let v = el.value.replace(/\D/g, '').replace(/^0+/, '');
    if (v && parseInt(v, 10) > MAX_RANK_INPUT) v = String(MAX_RANK_INPUT);
    if (v !== el.value) el.value = v;
  });
  rankInputsEl.appendChild(div);
});

const saRewardDayEl = document.getElementById('saRewardDay');
const saRankEl = document.getElementById('rank_supremeArena');
const dhRewardDayEl = document.getElementById('dhRewardDay');
const dhRankEl = document.getElementById('rank_dreamHunt');
const syncSaRewardDayState = () => {
  if (!saRewardDayEl || !saRankEl) return;
  const on = saRewardDayEl.checked;
  saRankEl.disabled = !on;
  saRankEl.placeholder = on ? saRankEl.dataset.ph : 'Not a reward day';
  if (!on) {
    saRankEl.value = '';
    saRankEl.style.borderColor = 'var(--panel-border)';
    saRankEl.style.color = 'var(--muted)';
    saRankEl.style.boxShadow = 'none';
  } else {
    colorRankInput('supremeArena');
  }
};
if (saRewardDayEl) {
  saRewardDayEl.addEventListener('change', syncSaRewardDayState);
}
// start disabled until Reward day is checked
syncSaRewardDayState();
const syncDhRewardDayState = () => {
  if (!dhRewardDayEl || !dhRankEl) return;
  const on = dhRewardDayEl.checked;
  dhRankEl.disabled = !on;
  dhRankEl.placeholder = on ? dhRankEl.dataset.ph : 'Not a reward day';
  if (!on) {
    dhRankEl.value = '';
    dhRankEl.style.borderColor = 'var(--panel-border)';
    dhRankEl.style.color = 'var(--muted)';
    dhRankEl.style.boxShadow = 'none';
  } else {
    colorRankInput('dreamHunt');
  }
};
if (dhRewardDayEl) {
  dhRewardDayEl.addEventListener('change', syncDhRewardDayState);
}
// start disabled until Reward day is checked
syncDhRewardDayState();

// Supreme League: only counts on a reward day. Without a stage ticked the
// rank is the knockout rank (1-48). "Out in swiss/group stage" put you in
// that bracket; the rank is required and only worked out
// behind the scenes (the rank is required to save a swiss/group exit).
const slRewardDayEl = document.getElementById('slRewardDay');
const slNoQualEl = document.getElementById('slNoQual');
const slKnockoutExitEl = document.getElementById('slKnockoutExit');
const slSwissExitEl = document.getElementById('slSwissExit');
const slGroupExitEl = document.getElementById('slGroupExit');
const slStageRowEl = slGroupExitEl
  ? slGroupExitEl.closest('.mode-check-row')
  : null;
const slRankEl = document.getElementById('rank_supremeLeague');
// Top 20 of the group stage advance to Swiss, so a group stage exit can
// only be rank 21-60; swiss stage exits are rank 49-80.
const SL_KO_MAX = 48;
const SL_SWISS_MIN = 49;
const SL_SWISS_MAX = 80;
const SL_GROUP_MIN = 21;
const SL_GROUP_MAX = 60;
const slStageOffset = () =>
  slGroupExitEl && slGroupExitEl.checked
    ? SL_GROUP_OFFSET
    : slSwissExitEl && slSwissExitEl.checked
      ? SL_SWISS_OFFSET
      : 0;
// forSave: also require the rank for a swiss/group stage exit
const validateSl = (forSave = false) => {
  const hint = document.getElementById('slHint');
  if (
    !hint ||
    !slRankEl ||
    !slGroupExitEl ||
    !slSwissExitEl ||
    !slKnockoutExitEl
  )
    return true;
  let msg = '';
  const raw = slRankEl.value;
  const v = parseInt(raw, 10);
  if (
    forSave &&
    !slRankEl.disabled &&
    (raw === '' || isNaN(v)) &&
    (slGroupExitEl.checked ||
      slSwissExitEl.checked ||
      slKnockoutExitEl.checked)
  ) {
    msg = slGroupExitEl.checked
      ? `Enter your Group Stage rank (${SL_GROUP_MIN}-${SL_GROUP_MAX}) to save.`
      : slSwissExitEl.checked
        ? `Enter your Swiss Stage rank (${SL_SWISS_MIN}-${SL_SWISS_MAX}) to save.`
        : `Enter your Knockout Stage rank (1-${SL_KO_MAX}) to save.`;
  } else if (!slRankEl.disabled && raw !== '' && !isNaN(v)) {
    if (slGroupExitEl.checked) {
      if (v < SL_GROUP_MIN || v > SL_GROUP_MAX) {
        msg = `Top 20 in the Group Stage advance to Swiss Stage, Group Stage exit rank is ${SL_GROUP_MIN}-${SL_GROUP_MAX}.`;
      }
    } else if (slSwissExitEl.checked) {
      if (v < SL_SWISS_MIN || v > SL_SWISS_MAX) {
        msg = `Top 48 in the Swiss Stage advance to Knockout Stage, Swiss Stage exit rank is ${SL_SWISS_MIN}-${SL_SWISS_MAX}.`;
      }
    } else if (slKnockoutExitEl.checked && (v < 1 || v > SL_KO_MAX)) {
      msg = `Knockout Stage rank must be 1-${SL_KO_MAX}.`;
    } else if (!slKnockoutExitEl.checked && v > SL_KO_MAX) {
      msg = `Knockout Stage is rank 1-${SL_KO_MAX}. If you were knocked out earlier, tick Swiss or Group Stage.`;
    }
  }
  hint.textContent = msg;
  hint.hidden = !msg;
  return !msg;
};
const syncSlState = () => {
  if (
    !slRewardDayEl ||
    !slRankEl ||
    !slGroupExitEl ||
    !slSwissExitEl ||
    !slKnockoutExitEl
  )
    return;
  const on = slRewardDayEl.checked;
  const stageChosen =
    slKnockoutExitEl.checked ||
    slSwissExitEl.checked ||
    slGroupExitEl.checked;
  if (slStageRowEl) {
    slStageRowEl.classList.toggle('sl-stage-hidden', !on);
    slStageRowEl.classList.toggle('sl-stage-active', on);
    slStageRowEl.classList.toggle('sl-stage-required', on);
  }
  [slKnockoutExitEl, slSwissExitEl, slGroupExitEl].forEach((el) => {
    el.disabled = !on;
  });
  if (!on) {
    slKnockoutExitEl.checked = false;
    slGroupExitEl.checked = false;
    slSwissExitEl.checked = false;
  }
  slRankEl.disabled =
    !on ||
    !(
      slKnockoutExitEl.checked ||
      slSwissExitEl.checked ||
      slGroupExitEl.checked
    );
  // the hint shows which ranks are valid for the current choice
  slRankEl.placeholder = on
    ? slGroupExitEl.checked
      ? `Rank ${SL_GROUP_MIN}-${SL_GROUP_MAX}`
      : slSwissExitEl.checked
        ? `Rank ${SL_SWISS_MIN}-${SL_SWISS_MAX}`
        : slKnockoutExitEl.checked
          ? `Rank 1-${SL_KO_MAX}`
          : 'Choose stage first'
    : slNoQualEl && slNoQualEl.checked
      ? 'Did not qualify'
      : 'Not a reward day';
  if (slRankEl.disabled) {
    slRankEl.value = '';
    slRankEl.style.borderColor = 'var(--panel-border)';
    slRankEl.style.color = 'var(--muted)';
    slRankEl.style.boxShadow = 'none';
  } else {
    colorRankInput('supremeLeague');
  }
  validateSl();
};
if (slRankEl) slRankEl.addEventListener('input', validateSl);
// "Did not qualify" and "Reward day" exclude each other
if (slNoQualEl)
  slNoQualEl.addEventListener('change', () => {
    if (slNoQualEl.checked && slRewardDayEl)
      slRewardDayEl.checked = false;
    syncSlState();
  });
if (slRewardDayEl)
  slRewardDayEl.addEventListener('change', () => {
    if (slRewardDayEl.checked && slNoQualEl) slNoQualEl.checked = false;
    syncSlState();
  });
// Stage choices are mutually exclusive; select one before entering a rank.
[slKnockoutExitEl, slSwissExitEl, slGroupExitEl].forEach((chosen) => {
  if (!chosen) return;
  chosen.addEventListener('change', () => {
    if (chosen.checked) {
      [slKnockoutExitEl, slSwissExitEl, slGroupExitEl].forEach(
        (other) => {
          if (other && other !== chosen) other.checked = false;
        },
      );
    }
    syncSlState();
  });
});
syncSlState();
const entryDateEl = document.getElementById('entryDate');
const entryDateLabel = document.getElementById('entryDateLabel');
const syncEntryDateLabel = () => {
  const v = entryDateEl.value || todayStr();
  entryDateLabel.textContent = formatDate(v);
};
entryDateEl.value = todayStr();
syncEntryDateLabel();
entryDateEl.addEventListener('change', syncEntryDateLabel);
entryDateEl.addEventListener('input', syncEntryDateLabel);
document.getElementById('entryDateBtn').addEventListener('click', () => {
  if (typeof entryDateEl.showPicker === 'function') {
    try {
      entryDateEl.showPicker();
      return;
    } catch (e) {}
  }
  entryDateEl.focus();
  entryDateEl.click();
});

const entryBossEl = document.getElementById('entryBoss');
const bossCurrentEl = document.getElementById('bossCurrent');
let bossManualOverride = false;
const entrySeason = () =>
  findSeasonForDate(
    document.getElementById('entryDate').value || todayStr(),
    loadSeasons(),
  );
// Select options: this season's rotation first, then every known boss
const fillBossOptions = (extra) => {
  const current = entryBossEl.value;
  const rot = rotationFor(entrySeason());
  const seen = new Set();
  const names = [];
  [...(rot ? rot.order : []), ...DREAM_BOSSES, current, extra].forEach(
    (n) => {
      const k = normBoss(n);
      if (!k || seen.has(k)) return;
      seen.add(k);
      names.push(n);
    },
  );
  entryBossEl.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Choose boss';
  entryBossEl.appendChild(blank);
  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    entryBossEl.appendChild(opt);
  });
  entryBossEl.value = current || '';
};
// First-time setup reminders. Top banner: add a season. Next to the boss
// field: add a boss rotation (only once a season exists).
const rotationReady = (season) => {
  const rot = season ? rotationFor(season) : null;
  return !!rot && rot.source === 'custom';
};
const updateSetupBanner = () => {
  const banner = document.getElementById('setupBanner');
  const textEl = document.getElementById('setupBannerText');
  const btn = document.getElementById('setupBannerBtn');
  const hint = document.getElementById('bossHint');
  if (!banner || !textEl || !btn) return;
  const seasons = loadSeasons();
  const season = entrySeason();
  if (!season) {
    banner.hidden = false;
    textEl.innerHTML = seasons.length
      ? 'No season covers this date. Add a season that includes it.'
      : 'Add the season you want to track before logging ranks.';
    btn.textContent = '+ Add a season';
    btn.onclick = () =>
      openNewSeasonModal(
        document.getElementById('entryDate').value || todayStr(),
      );
  } else {
    banner.hidden = true;
  }
  if (hint) hint.hidden = !season || rotationReady(season);
  // the button says what pressing it will do
  const saveBtn = document.getElementById('saveDayBtn');
  if (saveBtn) {
    saveBtn.textContent = !season
      ? 'Create season & save day'
      : !rotationReady(season)
        ? 'Set rotation & save day'
        : 'Save Day';
  }
};

// The boss comes from the season's rotation; the rotation is set up when
// a day is saved, and edited with the boss button on the Seasons tab.
const renderBossField = () => {
  fillBossOptions();
  const val = entryBossEl.value;
  const season = entrySeason();
  if (val && rotationReady(season)) {
    bossCurrentEl.textContent = val;
    bossCurrentEl.classList.remove('unset');
  } else if (season) {
    bossCurrentEl.textContent = 'Create a boss rotation';
    bossCurrentEl.classList.add('unset');
  } else {
    bossCurrentEl.textContent = 'Add a season first';
    bossCurrentEl.classList.add('unset');
  }
  updateSetupBanner();
};
const syncBossFromDate = () => {
  if (!bossManualOverride) {
    const date = document.getElementById('entryDate').value || todayStr();
    fillBossOptions();
    entryBossEl.value = bossForDate(date);
  }
  renderBossField();
};
syncBossFromDate();

const colorRankInput = (key) => {
  const input = document.getElementById('rank_' + key);
  if (!input || input.disabled) {
    if (input) {
      input.style.borderColor = 'var(--panel-border)';
      input.style.color = 'var(--muted)';
      input.style.boxShadow = 'none';
    }
    return;
  }
  let rank = parseInt(input.value, 10);
  if (key === 'supremeLeague') {
    if (!isNaN(rank)) rank += slStageOffset();
    else if (slStageOffset()) rank = slStageOffset(); // stage, no rank
  }
  const idx = getBracketIndex(key, rank);
  if (isNaN(rank) || idx === -1) {
    // Empty fields keep the subtle blue-grey focus treatment; as soon as
    // a valid rank is entered, the bracket colour takes over below.
    const empty = input.value.trim() === '';
    const focused = document.activeElement === input;
    input.style.borderColor = empty && focused
      ? 'rgba(120, 164, 235, 0.72)'
      : 'rgba(140, 162, 204, 0.28)';
    input.style.color = 'var(--text)';
    input.style.boxShadow = empty && focused
      ? '0 0 0 1px rgba(120, 164, 235, 0.12)'
      : 'none';
    return;
  }
  const c = tierColorForIndex(idx, MODES[key].brackets.length);
  input.style.borderColor = c;
  input.style.color = c;
  input.style.boxShadow = `0 0 8px ${c}55`;
};
Object.keys(MODES).forEach((key) => {
  const rankInput = document.getElementById('rank_' + key);
  rankInput.addEventListener('input', () => colorRankInput(key));
  rankInput.addEventListener('focus', () => colorRankInput(key));
  rankInput.addEventListener('blur', () => colorRankInput(key));
});

let showTodayLost = false;
let lastRenderedDayData = null;

const rewardToggleLabel = (label) =>
  `<svg class="reward-toggle-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v18M3 7l4-4 4 4M17 21V3m-4 14 4 4 4-4"/></svg><span>${label}</span>`;

const renderResultsForDay = (dayData, container) => {
  lastRenderedDayData = dayData;
  container.innerHTML = '';
  const date =
    dayData.date ||
    document.getElementById('entryDate').value ||
    todayStr();

  const header = document.createElement('div');
  header.className = 'day-results-header';
  header.innerHTML = dayContextHtml(date);
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className =
    'day-miss-toggle' + (showTodayLost ? ' active' : '');
  toggleBtn.innerHTML = rewardToggleLabel(
    showTodayLost ? 'Show gained rewards' : 'Show lost rewards',
  );
  toggleBtn.onclick = () => {
    showTodayLost = !showTodayLost;
    if (lastRenderedDayData) {
      renderResultsForDay(
        lastRenderedDayData,
        document.getElementById('todayResults'),
      );
    }
  };
  header.appendChild(toggleBtn);
  container.appendChild(header);

  const modesWrap = document.createElement('div');
  modesWrap.className = 'day-modes-wrap';
  const modesGrid = document.createElement('div');
  modesGrid.className = 'day-modes-grid';
  modesWrap.appendChild(modesGrid);

  const dayLost = {};
  const dayGained = {};
  const dayMax = {};
  Object.keys(CURRENCIES).forEach((c) => {
    dayLost[c] = 0;
    dayGained[c] = 0;
    dayMax[c] = 0;
  });
  let anyRank = false;

  Object.keys(MODES).forEach((modeKey) => {
    const rank = dayData.ranks[modeKey];
    const { bracket, got, lost, best } = computeLost(modeKey, rank);
    const box = document.createElement('div');
    box.className = 'result-mode';

    const modeOff = isModeInactive(modeKey, dayData);
    // Only add to day totals when the mode counts for this day
    if (rank && !modeOff) {
      anyRank = true;
      Object.keys(lost).forEach((c) => {
        dayLost[c] += lost[c] || 0;
      });
      Object.keys(got).forEach((c) => {
        dayGained[c] += got[c] || 0;
      });
      Object.keys(best).forEach((c) => {
        dayMax[c] += best[c] || 0;
      });
    } else if (rank) {
      anyRank = true;
    }

    let html = `<div class="mode-title">${MODES[modeKey].label}</div>`;
    if (modeKey === 'supremeArena' && dayData.saOff) {
      html += `<div class="bracket-note" style="color:var(--muted)">Not a reward day</div>`;
    } else if (
      (modeKey === 'dreamHunt' || modeKey === 'supremeLeague') &&
      modeOff
    ) {
      const offText =
        modeKey === 'supremeLeague' && dayData.slNoQual
          ? 'Did not qualify'
          : 'Not a reward day';
      html += `<div class="bracket-note" style="color:var(--muted)">${offText}</div>`;
    } else if (!rank) {
      html += `<div class="bracket-note">No rank entered</div>`;
    } else if (!bracket) {
      html +=
        modeKey === 'supremeLeague' && rank >= SL_NOQUAL_RANK
          ? `<div class="bracket-note"><strong style="color: var(--red);">Did not qualify</strong> - no rewards</div>`
          : `<div class="bracket-note">Rank <strong style="color: var(--red);">${rankText(modeKey, rank)}</strong> - outside reward brackets</div>`;
    } else {
      const idx = getBracketIndex(modeKey, rank);
      const c = tierColorForIndex(idx, MODES[modeKey].brackets.length);
      const bLabel =
        modeKey === 'supremeLeague'
          ? bracketLabel(modeKey, bracket)
          : `${bracket.min}-${bracket.max}`;
      const rNum = rankNumText(modeKey, rank);
      html += rNum
        ? `<div class="bracket-note">Rank <strong style="color: ${c};">${rNum}</strong> - bracket <strong style="color: ${c};">${bLabel}</strong></div>`
        : `<div class="bracket-note">Bracket <strong style="color: ${c};">${bLabel}</strong></div>`;
    }
    if (!modeOff && rank)
      CURRENCY_KEYS.forEach((c) => {
        if (!(c in best)) return;
        const cur = CURRENCIES[c];
        const gotVal = got[c] || 0;
        const lostVal = lost[c] || 0;
        const maxVal = best[c] || 0;

        if (showTodayLost) {
          const itemPct =
            maxVal > 0 ? Math.round((lostVal / maxVal) * 100) : 0;
          const isZero = lostVal === 0;
          const isTotalLoss = itemPct === 100 && maxVal > 0;
          const lostClass = isZero
            ? 'reward-lost-val zero'
            : isTotalLoss
              ? 'reward-lost-val total-loss-val'
              : 'reward-lost-val';

          const valColor = isZero
            ? 'color:#ffffff; font-weight:800;'
            : isTotalLoss
              ? 'color:var(--red-dark); font-weight:800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
              : 'color:var(--red); font-weight:750;';
          const pctStyle = isZero
            ? 'color:#ffffff; font-weight:800;'
            : isTotalLoss
              ? 'color:var(--red-dark); font-weight:800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
              : 'color:var(--red); font-weight:750;';

          html += `<div class="reward-row">
    <span class="reward-name">${renderItemBadge(cur)}</span>
    <span class="reward-nums">
      <span class="${lostClass}" style="${valColor}">${lostVal.toLocaleString()}</span><span class="reward-total-val">/${maxVal.toLocaleString()}</span> <span class="reward-pct" style="${pctStyle}">(${itemPct}%)</span>
    </span>
  </div>`;
        } else {
          const itemPct =
            maxVal > 0 ? Math.round((gotVal / maxVal) * 100) : 0;
          const isFull = itemPct === 100 && maxVal > 0;
          const isZero = gotVal === 0;

          const valColor = isZero
            ? 'color:var(--red); font-weight:800;'
            : isFull
              ? 'color:var(--gold); font-weight:800;'
              : 'color:var(--green-dark); font-weight:750;';
          const pctStyle = isZero
            ? 'color:var(--red); font-weight:800;'
            : isFull
              ? 'color:var(--gold); font-weight:800;'
              : 'color:var(--green-dark); font-weight:750;';

          html += `<div class="reward-row">
    <span class="reward-name">${renderItemBadge(cur)}</span>
    <span class="reward-nums">
      <span class="reward-got ${isZero ? 'zero' : ''}" style="${valColor}">${gotVal.toLocaleString()}</span><span class="reward-total-val">/${maxVal.toLocaleString()}</span> <span class="reward-pct" style="${pctStyle}">(${itemPct}%)</span>
    </span>
  </div>`;
        }
      });
    box.innerHTML = html;
    modesGrid.appendChild(box);
  });
  container.appendChild(modesWrap);

  const summary = document.createElement('div');
  summary.className =
    'day-summary totals-window' + (showTodayLost ? ' lost' : '');
  if (!anyRank) {
    summary.innerHTML =
      '<div class="bracket-note" style="margin:0">No ranks entered for this day.</div>';
  } else {
    const groupDayRows = (rowByKey) => {
      const miscKeys = MISC_CURRENCY_KEYS.filter((c) => rowByKey[c]);
      const essKeys = ESSENCE_CURRENCY_KEYS.filter((c) => rowByKey[c]);
      const misc = miscKeys.map((c) => rowByKey[c]).join('');
      const ess = essKeys.map((c) => rowByKey[c]).join('');
      let out = '';
      if (misc) {
        const n = Math.min(Math.max(miscKeys.length, 1), 4);
        out += `<div class="day-summary-row-group misc n${n}">${misc}</div>`;
      }
      if (ess) {
        const n = Math.min(Math.max(essKeys.length, 1), 4);
        out += `<div class="day-summary-row-group essences n${n}">${ess}</div>`;
      }
      return out;
    };

    if (!showTodayLost) {
      const totalGainedSum = Object.values(dayGained).reduce(
        (a, b) => a + b,
        0,
      );
      const totalMaxSum = Object.values(dayMax).reduce(
        (a, b) => a + b,
        0,
      );
      const isPerfectDay =
        totalGainedSum === totalMaxSum && totalMaxSum > 0;
      const isTotalZeroDay = totalGainedSum === 0 && totalMaxSum > 0;

      const gainRowByKey = {};
      CURRENCY_KEYS.filter((c) => dayMax[c] > 0).forEach((c) => {
        const cur = CURRENCIES[c];
        const gotVal = dayGained[c];
        const maxVal = dayMax[c];
        const pct = maxVal > 0 ? Math.round((gotVal / maxVal) * 100) : 0;
        const isFull = pct === 100 && maxVal > 0;
        const isZero = gotVal === 0;
        const valColor = isZero
          ? 'color:var(--red); font-weight:800;'
          : isFull
            ? 'color:var(--gold); font-weight:800;'
            : 'color:var(--green-dark); font-weight:750;';
        const pctStyle = isZero
          ? 'color:var(--red); font-weight:800;'
          : isFull
            ? 'color:var(--gold); font-weight:800;'
            : 'color:var(--green-dark); font-weight:750;';
        gainRowByKey[c] = `<div class="day-summary-row">
            <span class="day-sum-item">${renderItemBadge(cur)}</span>
            <span class="day-sum-nums"><span style="${valColor}">${gotVal.toLocaleString()}</span><span style="color:#ffffff">/${maxVal.toLocaleString()}</span> <span class="reward-pct" style="${pctStyle}">(${pct}%)</span></span>
          </div>`;
      });
      const gainGrouped =
        groupDayRows(gainRowByKey) ||
        '<span class="bracket-note">No rewards gained</span>';

      summary.innerHTML = `<div class="day-summary-block">
        <div class="day-summary-title reward-state-title">Rewards gained for the day</div>
        <div class="day-summary-items horizontal-grid">${gainGrouped}</div>
      </div>`;
    } else {
      const lostRowByKey = {};
      CURRENCY_KEYS.filter((c) => dayMax[c] > 0).forEach((c) => {
        const cur = CURRENCIES[c];
        const lostVal = dayLost[c];
        const maxVal = dayMax[c];
        const pct = maxVal > 0 ? Math.round((lostVal / maxVal) * 100) : 0;
        const isZero = lostVal === 0;
        const isTotalLoss = pct === 100 && maxVal > 0;
        const valClass = isZero
          ? 'reward-lost-val zero'
          : isTotalLoss
            ? 'reward-lost-val total-loss-val'
            : 'reward-lost-val';
        const valColor = isZero
          ? 'color:#ffffff; font-weight:800;'
          : isTotalLoss
            ? 'color:var(--red-dark); font-weight:800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
            : 'color:var(--red); font-weight:750;';
        const pctStyle = isZero
          ? 'color:#ffffff; font-weight:800;'
          : isTotalLoss
            ? 'color:var(--red-dark); font-weight:800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
            : 'color:var(--red); font-weight:750;';
        lostRowByKey[c] = `<div class="day-summary-row">
            <span class="day-sum-item">${renderItemBadge(cur)}</span>
            <span class="day-sum-nums ${valClass}"><span style="${valColor}">${lostVal.toLocaleString()}</span><span style="color:#ffffff">/${maxVal.toLocaleString()}</span> <span class="reward-pct" style="${pctStyle}">(${pct}%)</span></span>
          </div>`;
      });
      const lostGrouped = groupDayRows(lostRowByKey);
      let html = '';
      const totalLostSum = Object.values(dayLost).reduce(
        (a, b) => a + b,
        0,
      );
      const totalMaxSum = Object.values(dayMax).reduce(
        (a, b) => a + b,
        0,
      );
      html = `<div class="day-summary-block">
        <div class="day-summary-title reward-state-title is-lost">Rewards lost for the day</div>
        <div class="day-summary-items horizontal-grid">${lostGrouped}</div>
      </div>`;
      summary.innerHTML = html;
    }
  }
  container.appendChild(summary);
};

const saveDay = () => {
  if (!validateSl(true)) return;
  const date = document.getElementById('entryDate').value || todayStr();
  // A day can only be saved once a season exists and its boss rotation
  // is set. Missing pieces are asked for in order (season first, then
  // rotation) and the day is saved when the last one is done.
  const seasons = loadSeasons();
  const season = findSeasonForDate(date, seasons);
  if (!season) {
    pendingSaveAfterSeason = true;
    openNewSeasonModal(date);
    updateSetupBanner();
    return;
  }
  if (!rotationReady(season)) {
    pendingSaveAfterRotation = true;
    openBossRotationModal(season.id);
    updateSetupBanner();
    return;
  }
  const saRewardChecked = !!(saRewardDayEl && saRewardDayEl.checked);
  const days = loadDays();
  const existing = days[date] || null;
  const ranks = {};
  Object.keys(MODES).forEach((key) => {
    if (key === 'supremeLeague' && slStageOffset()) {
      // swiss/group exit: the rank is required, the stage decides the
      // bracket
      const g = parseInt(
        document.getElementById('rank_supremeLeague').value,
        10,
      );
      ranks[key] = slStageOffset() + (!isNaN(g) && g >= 1 ? g : 0);
      return;
    }
    const raw = document.getElementById('rank_' + key).value;
    const val = parseInt(raw, 10);
    if (raw !== '' && !isNaN(val)) {
      ranks[key] = val;
    } else {
      // the inputs always show the saved day, so empty = no rank
      ranks[key] = null;
    }
  });
  // The checkboxes mirror the saved day too, so they decide the flags.
  // Supreme Arena / Dream Hunt: Reward day ticked = the day counts.
  const saOff = !saRewardChecked;
  const dhRewardDay = !!(dhRewardDayEl && dhRewardDayEl.checked);
  // Supreme League: Reward day or Did not qualify
  const slChecked = !!(slRewardDayEl && slRewardDayEl.checked);
  const slNoQual = !!(slNoQualEl && slNoQualEl.checked);
  const slRewardDay = slChecked || slNoQual;
  if (slNoQual) {
    // didn't qualify: a played day with no rewards, so all the possible
    // rewards count as lost
    ranks.supremeLeague = SL_NOQUAL_RANK;
  }
  const boss = entryBossEl.value || bossForDate(date);
  days[date] = {
    date,
    ranks,
    boss,
    saOff,
    dhRewardDay,
    slRewardDay,
    slNoQual,
  };
  saveDays(days);
  // first save creates the season, so the boss field was still "not
  // set" - show the boss the day was actually saved with
  if (boss && !entryBossEl.value) {
    fillBossOptions(boss);
    entryBossEl.value = boss;
  }
  renderBossField();
  // inputs stay as entered so the day can be edited further
  renderResultsForDay(
    days[date],
    document.getElementById('todayResults'),
  );
  renderHistory();
  renderOverall();
  renderSeason();
};

document.getElementById('saveDayBtn').onclick = () => {
  saveDay();
};

const dayContextHtml = (date) => {
  const seasons = loadSeasons();
  const season = findSeasonForDate(date, seasons);
  if (!season) {
    return `<div class="bracket-note" style="font-size:16px">${formatDate(date)}</div>`;
  }
  const dayNum = seasonDayNumber(date, season.start);
  return `<div class="bracket-note" style="font-size:16px">
    <strong style="color:var(--gold)">${seasonLabel(season)}</strong>
    <strong style="color:#ffffff">· ${formatDate(date)} · <span style="color:var(--muted)">Day</span> ${dayNum}</strong>
  </div>`;
};

// Show the saved day (if any) in the inputs, so an old day can be opened
// and filled out further. A date with nothing saved gets empty inputs.
const fillInputsFromDay = (day) => {
  const setRank = (key, v) => {
    document.getElementById('rank_' + key).value = v == null ? '' : v;
  };
  const r = (day && day.ranks) || {};
  if (saRewardDayEl) saRewardDayEl.checked = !!day && !day.saOff;
  if (dhRewardDayEl) dhRewardDayEl.checked = !!(day && day.dhRewardDay);
  const slNo = !!(day && day.slNoQual);
  if (slNoQualEl) slNoQualEl.checked = slNo;
  if (slRewardDayEl)
    slRewardDayEl.checked = !!(day && day.slRewardDay) && !slNo;
  const slr = r.supremeLeague;
  const slSt = slr ? slStage(slr) : null;
  if (slKnockoutExitEl) slKnockoutExitEl.checked = !slNo && slSt === 'ko';
  if (slSwissExitEl) slSwissExitEl.checked = !slNo && slSt === 'swiss';
  if (slGroupExitEl) slGroupExitEl.checked = !slNo && slSt === 'group';
  // enable/disable first (this also empties disabled inputs) ...
  syncSaRewardDayState();
  syncDhRewardDayState();
  syncSlState();
  // ... then fill in the saved ranks
  Object.keys(MODES).forEach((key) => {
    if (key === 'supremeLeague') {
      if (slNo || !slr) return setRank(key, null);
      if (slSt === 'swiss') {
        return setRank(
          key,
          slr > SL_SWISS_OFFSET ? slr - SL_SWISS_OFFSET : null,
        );
      }
      if (slSt === 'group') {
        return setRank(
          key,
          slr > SL_GROUP_OFFSET ? slr - SL_GROUP_OFFSET : null,
        );
      }
      return setRank(key, slr);
    }
    if (
      key === 'supremeArena' &&
      !(saRewardDayEl && saRewardDayEl.checked)
    )
      return;
    if (key === 'dreamHunt' && !(dhRewardDayEl && dhRewardDayEl.checked))
      return;
    setRank(key, r[key]);
  });
  Object.keys(MODES).forEach((key) => colorRankInput(key));
  validateSl();
};

const preloadToday = () => {
  const days = loadDays();
  const date = document.getElementById('entryDate').value;
  bossManualOverride = false;
  fillInputsFromDay(days[date] || null);
  syncBossFromDate();
  // a saved day keeps the boss it was saved with
  if (days[date] && days[date].boss) {
    fillBossOptions();
    entryBossEl.value = days[date].boss;
    renderBossField();
  }
  if (days[date]) {
    renderResultsForDay(
      days[date],
      document.getElementById('todayResults'),
    );
  } else {
    document.getElementById('todayResults').innerHTML = '';
  }
};
document.getElementById('entryDate').onchange = preloadToday;
preloadToday();

const computeTotalsForDays = (days, dateFilterFn) => {
  const lost = {};
  const gained = {};
  const maxPossible = {};
  Object.keys(CURRENCIES).forEach((c) => {
    lost[c] = 0;
    gained[c] = 0;
    maxPossible[c] = 0;
  });
  Object.keys(days).forEach((date) => {
    if (dateFilterFn && !dateFilterFn(date)) return;
    Object.keys(MODES).forEach((modeKey) => {
      if (isModeInactive(modeKey, days[date])) return;
      const rank = days[date].ranks[modeKey];
      if (!rank) return;
      const {
        lost: dayLost,
        got: dayGot,
        best,
      } = computeLost(modeKey, rank);
      Object.keys(best).forEach((c) => {
        lost[c] += dayLost[c] || 0;
        gained[c] += dayGot[c] || 0;
        maxPossible[c] += best[c];
      });
    });
  });
  return { lost, gained, maxPossible };
};

const renderTotalsGrid = (
  gridEl,
  totalsData,
  showLost = false,
  scopeLabel = 'this period',
) => {
  const { lost, gained, maxPossible } = totalsData;
  const anyMax = Object.values(maxPossible).some((v) => v > 0);
  if (!anyMax) {
    gridEl.innerHTML = `<div class="empty" style="padding:16px;">No rewards logged yet for ${scopeLabel}.</div>`;
    return;
  }
  const boxHtml = (c) => {
    const maxVal = maxPossible[c] || 0;
    const cur = CURRENCIES[c];
    if (showLost) {
      const lostVal = lost[c] || 0;
      const pct = maxVal > 0 ? Math.round((lostVal / maxVal) * 100) : 0;
      const zero = lostVal === 0;
      const isTotalLoss = pct === 100 && maxVal > 0;
      const valColorStyle = zero
        ? 'color: #ffffff;'
        : isTotalLoss
          ? 'color: var(--red-dark); font-weight: 800; text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);'
          : 'color: #fb7185;';
      return `<div class="season-box">
    <div class="cur-label">${renderItemBadge(cur)}</div>
    <div class="cur-val" style="${zero ? 'color: #ffffff;' : isTotalLoss ? 'color: var(--red-dark); text-shadow: 0 0 6px rgba(244, 63, 94, 0.4);' : 'color: var(--red);'}">
      ${lostVal.toLocaleString()}<span class="total-num">/${maxVal.toLocaleString()}</span> (<span style="${valColorStyle}">${pct}%</span>)
    </div>
  </div>`;
    }
    const gainVal = gained[c] || 0;
    const pct = maxVal > 0 ? Math.round((gainVal / maxVal) * 100) : 0;
    const isFull = pct === 100 && maxVal > 0;
    const zero = gainVal === 0 && maxVal > 0;
    const valColorStyle = zero
      ? 'color: var(--red-dark);'
      : isFull
        ? 'color: var(--gold); font-weight: 800;'
        : 'color: var(--green-dark);';
    const pctColorStyle = zero
      ? 'color: var(--red-dark);'
      : isFull
        ? 'color: var(--gold); font-weight: 800;'
        : 'color: var(--green-dark);';
    return `<div class="season-box">
    <div class="cur-label">${renderItemBadge(cur)}</div>
    <div class="cur-val" style="${valColorStyle}">
      ${gainVal.toLocaleString()}<span class="total-num">/${maxVal.toLocaleString()}</span> (<span style="${pctColorStyle}">${pct}%</span>)
    </div>
  </div>`;
  };
  gridEl.innerHTML = `
    <div class="season-grid-row misc">${MISC_CURRENCY_KEYS.map(boxHtml).join('')}</div>
    <div class="season-grid-row essences">${ESSENCE_CURRENCY_KEYS.map(boxHtml).join('')}</div>
  `;
};

const DR_MODE_KEYS = ['drServer', 'drDistrict'];

const computeBossBracketDist = (days, dateFilterFn) => {
  const stats = {};
  const ensure = (boss) => {
    if (!stats[boss]) {
      stats[boss] = {};
      DR_MODE_KEYS.forEach((mk) => {
        const brackets = MODES[mk].brackets;
        stats[boss][mk] = {
          counts: brackets.map(() => 0),
          outside: 0,
          total: 0,
          brackets,
        };
      });
    }
    return stats[boss];
  };
  Object.keys(days).forEach((date) => {
    if (dateFilterFn && !dateFilterFn(date)) return;
    const d = days[date];
    const boss = d.boss || bossForDate(date);
    if (!boss) return;
    const entry = ensure(boss);
    DR_MODE_KEYS.forEach((mk) => {
      const rank = d.ranks[mk];
      if (!rank) return;
      const slot = entry[mk];
      slot.total++;
      const idx = getBracketIndex(mk, rank);
      if (idx === -1) slot.outside++;
      else slot.counts[idx]++;
    });
  });
  return stats;
};

const renderBossBracketDist = (container, stats) => {
  const names = [
    ...DREAM_BOSSES,
    ...Object.keys(stats).filter((b) => !DREAM_BOSSES.includes(b)),
  ];
  const active = names.filter((b) => {
    const s = stats[b];
    return s && DR_MODE_KEYS.some((mk) => s[mk].total > 0);
  });
  if (!active.length) {
    container.innerHTML =
      '<div class="empty" style="padding:16px;">No boss rankings logged for this period.</div>';
    return;
  }
  const cards = active
    .map((boss) => {
      const entry = stats[boss];
      const modeBlocks = DR_MODE_KEYS.map((mk) => {
        const { counts, outside, total, brackets } = entry[mk];
        const shortLabel = mk === 'drServer' ? 'Server' : 'District';
        if (total === 0) {
          return `<div class="dist-mode">
        <div class="dist-title">${shortLabel}</div>
        <div class="dist-empty">No ranks</div>
      </div>`;
        }
        const rows = brackets
          .map((b, idx) => {
            const n = counts[idx];
            const pct = Math.round((n / total) * 100);
            const c = tierColorForIndex(idx, brackets.length);
            const label =
              b.min === 1 ? `Top ${b.max}` : `${b.min}-${b.max}`;
            return `<div class="dist-row">
        <span class="dist-label" style="color:${c}">${label}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar" style="width:${pct}%;background:${c}"></div>
        </div>
        <span class="dist-pct" style="color:${c}">${pct}%</span>
        <span class="dist-count">${n}/${total}</span>
      </div>`;
          })
          .join('');
        const outPct = Math.round((outside / total) * 100);
        const outRow =
          outside > 0
            ? `<div class="dist-row">
        <span class="dist-label" style="color:var(--red)">Outside</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar" style="width:${outPct}%;background:var(--red)"></div>
        </div>
        <span class="dist-pct" style="color:var(--red)">${outPct}%</span>
        <span class="dist-count">${outside}/${total}</span>
      </div>`
            : '';
        return `<div class="dist-mode">
      <div class="dist-title">${shortLabel}</div>
      ${rows}${outRow}
    </div>`;
      }).join('');
      const dayHint = DR_MODE_KEYS.reduce(
        (m, mk) => Math.max(m, entry[mk].total),
        0,
      );
      return `<div class="boss-dist-card">
    <div class="boss-dist-name">
      ${boss}<span class="boss-dist-days">${dayHint} day${dayHint === 1 ? '' : 's'}</span>
    </div>
    ${modeBlocks}
  </div>`;
    })
    .join('');
  container.innerHTML = `<div class="boss-dist-grid">${cards}</div>`;
};

const renderOverall = () => {
  const days = loadDays();
  const dist = computeBracketDist(days, null, showOverallLost);
  renderDist(
    document.getElementById('overallDist'),
    dist,
    showOverallLost,
    'this period',
  );
  renderBossBracketDist(
    document.getElementById('overallBossWrap'),
    computeBossBracketDist(days, null),
  );
  const totals = computeTotalsForDays(days, null);
  renderTotalsGrid(
    document.getElementById('overallTotalsGrid'),
    totals,
    showOverallLost,
    'this period',
  );
  renderOverallStats(days);
};

const colorRecapHeadline = (headline) => `<span class="recap-headline">${headline
  .replace(/(#[0-9][0-9,]*(?:\.[0-9]+)?)/g, '<span class="rank-value">$1</span>')
  .replace(/\b(improved|improvement|improving|increased|increase)\b/gi, '<span class="season-trend-positive">$1</span>')
  .replace(/\b(worsened|worsening|declined|decline|decreased|decrease)\b/gi, '<span class="season-trend-negative">$1</span>')}</span>`;

const buildSeasonRecap = (modeKey, seasonEntries, range) => {
  const ordered = [...seasonEntries].sort((a, b) => a.date.localeCompare(b.date));
  const fmt = (n) => `#${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  if (!ordered.length) return { headline: 'No rankings recorded', detail: 'No results were recorded for this mode during this season.' };
  const average = (items) => items.reduce((sum, item) => sum + item.numeric, 0) / items.length;
  const compare = (early, late, label) => {
    if (!early.length || !late.length) return { headline: 'Not enough data to compare', detail: 'Rankings are needed from both the early and late parts of the season.' };
    const a = average(early), b = average(late);
    const diff = a - b;
    const headline = Math.abs(diff) < 0.05
      ? `Average rank stayed similar: ${fmt(a)} → ${fmt(b)}`
      : diff > 0
        ? `Average rank improved: ${fmt(a)} → ${fmt(b)}`
        : `Average rank worsened: ${fmt(a)} → ${fmt(b)}`;
    const detail = 'Compared average ranks in the first and final quarters of the season.';
    return { headline, detail };
  };
  if (modeKey === 'supremeLeague') {
    if (ordered.length === 1) return { headline: `Latest recorded rank: ${ordered[0].display}`, detail: `One ranking recorded on ${formatDate(ordered[0].date)}; more results are needed to show a trend.` };
    const first = ordered[0], last = ordered[ordered.length - 1];
    const diff = first.numeric - last.numeric;
    const headline = Math.abs(diff) < 0.05
      ? `Rank stayed similar: ${first.display} → ${last.display}`
      : diff > 0
        ? `Rank improved: ${first.display} → ${last.display}`
        : `Rank worsened: ${first.display} → ${last.display}`;
    return { headline, detail: `First result: ${formatDate(first.date)} · Latest result: ${formatDate(last.date)} · ${ordered.length} rankings recorded.` };
  }
  const startDate = range?.start || ordered[0].date;
  const endDate = range?.end || ordered[ordered.length - 1].date;
  const startMs = Date.parse(startDate + 'T12:00:00Z');
  const endMs = Date.parse(endDate + 'T12:00:00Z');
  const duration = Math.max(86400000, endMs - startMs);
  const firstQuarterEnd = startMs + duration * 0.25;
  const finalQuarterStart = endMs - duration * 0.25;
  const early = ordered.filter((entry) => { const ms = Date.parse(entry.date + 'T12:00:00Z'); return ms >= startMs && ms <= firstQuarterEnd; });
  const late = ordered.filter((entry) => { const ms = Date.parse(entry.date + 'T12:00:00Z'); return ms >= finalQuarterStart && ms <= endMs; });
  return compare(early, late, 'early-season');
};

let overallStatsSelectedMode = '';
const renderOverallStats = (days) => {
  const select = document.getElementById('overallStatsMode');
  const summary = document.getElementById('overallStatsSummary');
  const chart = document.getElementById('overallStatsChart');
  if (!select || !summary || !chart) return;
  const modeKeys = Object.keys(MODES).filter((key) =>
    Object.keys(days).some((date) => {
      const raw = days[date].ranks && days[date].ranks[key];
      return raw != null && (key !== 'supremeLeague' || rankNumText(key, raw) != null);
    }),
  );
  const availableKeys = modeKeys.length ? modeKeys : Object.keys(MODES);
  const previous = overallStatsSelectedMode || select.value;
  select.innerHTML = availableKeys.map((key) => `<option value="${key}">${MODES[key].label}</option>`).join('');
  select.value = availableKeys.includes(previous) ? previous : availableKeys[0];
  overallStatsSelectedMode = select.value;
  select.onchange = () => { overallStatsSelectedMode = select.value; renderOverallStats(days); };
  const modeKey = select.value;
  const entries = Object.keys(days).sort().filter((date) => {
    const raw = days[date].ranks && days[date].ranks[modeKey];
    return raw != null && (modeKey !== 'supremeLeague' || rankNumText(modeKey, raw) != null);
  }).map((date) => {
    const raw = days[date].ranks[modeKey];
    const display = rankText(modeKey, raw);
    const numericText = modeKey === 'supremeLeague' ? rankNumText(modeKey, raw) : String(raw);
    const numeric = Number(String(numericText || '').replace('#', ''));
    return { date, raw, display, numeric };
  }).filter((entry) => Number.isFinite(entry.numeric) && entry.numeric > 0);
  const stat = (label, value, detail='') => `<div class="season-progress-stat"><div class="season-progress-stat-label">${label}</div><div class="season-progress-stat-value">${value}</div>${detail ? `<div class="season-progress-stat-detail">${detail}</div>` : ''}</div>`;
  const seasonRecaps = document.getElementById('overallSeasonRecaps');
  const renderSeasonRecaps = () => {
    if (!seasonRecaps) return;
    const seasons = [...loadSeasons()].sort((a, b) => a.start.localeCompare(b.start));
    const completed = seasons.map((season) => {
      const range = getSeasonDateRange(seasons, season);
      if (!range.end || todayStr() <= range.end) return null;
      const seasonEntries = entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
      return { name: seasonLabel(season), ...buildSeasonRecap(modeKey, seasonEntries, range) };
    }).filter(Boolean).reverse();
    seasonRecaps.innerHTML = `<div class="overall-season-recaps-heading">Overall season-by-season recap · ${escapeHtml(MODES[modeKey].label)}</div>${completed.length ? `<div class="overall-season-recap-list">${completed.map((item) => `<div class="overall-season-recap-item"><div class="overall-season-recap-name">${escapeHtml(item.name || 'Season')}</div><div class="overall-season-recap-result">${colorRecapHeadline(item.headline)}</div><div class="overall-season-recap-detail">${item.detail}</div></div>`).join('')}</div>` : '<div class="empty-state" style="padding:14px 12px">Your season recaps will appear here after a season ends.</div>'}`;
  };
  renderSeasonRecaps();
  const getOverallTrend = () => {
    const seasons = [...loadSeasons()].sort((a, b) => a.start.localeCompare(b.start));
    const seasonalAverages = seasons.map((season) => {
      const range = getSeasonDateRange(seasons, season);
      const seasonEntries = entries.filter((entry) => entry.date >= range.start && (!range.end || entry.date <= range.end));
      if (!seasonEntries.length) return null;
      return { name: seasonLabel(season) || 'Season', average: seasonEntries.reduce((sum, entry) => sum + entry.numeric, 0) / seasonEntries.length };
    }).filter(Boolean);
    if (seasonalAverages.length < 2) return { value: 'Not enough data', detail: 'Results from 2 seasons are needed', cls: 'neutral' };
    const previous = seasonalAverages[seasonalAverages.length - 2];
    const current = seasonalAverages[seasonalAverages.length - 1];
    const difference = previous.average - current.average;
    const fmt = (n) => `#${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
    const cls = difference > 0.05 ? 'positive' : difference < -0.05 ? 'negative' : 'neutral';
    const detail = `<span class="recap-headline">Average rank <span class="rank-value">${fmt(previous.average)}</span> → <span class="season-trend-${cls}">${fmt(current.average)}</span></span>`;
    if (cls === 'positive') return { value: 'Improving ↑', detail, cls: 'positive' };
    if (cls === 'negative') return { value: 'Declining ↓', detail, cls: 'negative' };
    return { value: 'Stable →', detail, cls: 'neutral' };
  };
  const overallTrend = getOverallTrend();
  if (!entries.length) {
    summary.innerHTML = stat('Average rank', '—', 'No recorded results') + stat('Best rank', '—', 'No recorded results') + stat('Worst rank', '—', 'No recorded results') + stat('Overall trend · season average', 'Not enough data', 'Results from 2 seasons are needed');
    chart.style.width = '100%'; chart.style.minWidth = '0';
    chart.innerHTML = '<div class="empty-state" style="padding:26px 12px">Your rank history will appear here once you log a result for this mode.</div>';
    return;
  }
  const average = entries.reduce((sum, entry) => sum + entry.numeric, 0) / entries.length;
  const best = entries.reduce((a, b) => a.numeric < b.numeric ? a : b);
  const worst = entries.reduce((a, b) => a.numeric > b.numeric ? a : b);
  const avgLabel = `#${Math.round(average).toLocaleString('en-US')}`;
  summary.innerHTML = stat('Average rank', avgLabel, `${entries.length} recorded result${entries.length === 1 ? '' : 's'}`) + stat('Best rank', best.display, formatDate(best.date)) + stat('Worst rank', worst.display, formatDate(worst.date)) + stat('Overall trend · season average', `<span class="season-trend-${overallTrend.cls}">${overallTrend.value}</span>`, overallTrend.detail);
  // Compress the all-time timeline to one point per calendar week. This keeps
  // several seasons readable without making the chart wider or overcrowded.
  const weekStart = (date) => {
    const d = new Date(date + 'T12:00:00Z');
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };
  const buckets = new Map();
  entries.forEach((entry) => {
    const key = weekStart(entry.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  });
  const weekly = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([start, items]) => {
    const endDateObj = new Date(start + 'T12:00:00Z');
    endDateObj.setUTCDate(endDateObj.getUTCDate() + 6);
    const end = endDateObj.toISOString().slice(0, 10);
    return { date: start, end, numeric: items.reduce((sum, item) => sum + item.numeric, 0) / items.length, count: items.length };
  });
  const W = Math.max(800, weekly.length * 26 + 76), H = 270;
  const pad = { l: 54, r: 22, t: 20, b: 42 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  let min = Math.min(...weekly.map((entry) => entry.numeric));
  let max = Math.max(...weekly.map((entry) => entry.numeric));
  if (min === max) { min = Math.max(1, min - 1); max += 1; }
  const range = max - min || 1;
  const yMin = Math.max(1, min - range * .12), yMax = max + range * .12;
  const firstMs = Date.parse(weekly[0].date + 'T12:00:00Z');
  const lastMs = Date.parse(weekly[weekly.length - 1].date + 'T12:00:00Z');
  const span = Math.max(86400000, lastMs - firstMs);
  const x = (date) => pad.l + ((Date.parse(date + 'T12:00:00Z') - firstMs) / span) * plotW;
  const y = (rank) => pad.t + ((yMax - rank) / (yMax - yMin)) * plotH;
  let svg = `<svg class="season-progress-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly average rank history across all seasons for ${MODES[modeKey].label}"><defs><linearGradient id="overallRankFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8c244" stop-opacity=".14"/><stop offset="100%" stop-color="#f8c244" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i <= 4; i++) {
    const value = yMin + ((yMax - yMin) * i / 4), yy = y(value);
    svg += `<line class="gridline" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="${pad.l-10}" y="${yy+4}" text-anchor="end">#${Math.round(value)}</text>`;
  }
  // Mark season boundaries so the all-time graph is easy to read across multiple seasons.
  const chartSeasons = [...loadSeasons()].sort((a, b) => a.start.localeCompare(b.start));
  const visibleSeasons = chartSeasons.filter((season) => season.start <= weekly[weekly.length - 1].date && (!getSeasonDateRange(chartSeasons, season).end || getSeasonDateRange(chartSeasons, season).end >= weekly[0].date));
  const seasonSegments = visibleSeasons.map((season) => ({
    season,
    start: season.start < weekly[0].date ? weekly[0].date : season.start,
    end: (() => { const range = getSeasonDateRange(chartSeasons, season); return !range.end || range.end > weekly[weekly.length - 1].date ? weekly[weekly.length - 1].date : range.end; })(),
  })).filter((segment) => segment.start <= segment.end);
  seasonSegments.forEach((segment, index) => {
    const startX = x(segment.start);
    const endX = x(segment.end);
    if (index > 0 && segment.start >= weekly[0].date && segment.start <= weekly[weekly.length - 1].date) {
      svg += `<line x1="${startX}" y1="${pad.t}" x2="${startX}" y2="${pad.t + plotH}" stroke="var(--gold)" stroke-opacity=".6" stroke-width="1.2" stroke-dasharray="4 4"><title>${escapeHtml(seasonLabel(segment.season))} begins</title></line>`;
    }
    const segmentWidth = endX - startX;
    if (segmentWidth > 44) {
      const label = seasonLabel(segment.season) || 'Season';
      svg += `<text x="${(startX + endX) / 2}" y="12" text-anchor="middle" fill="var(--gold)" style="font-size:10px;font-weight:700">${escapeHtml(label)}</text>`;
    }
  });
  const points = weekly.map((entry) => `${x(entry.date)},${y(entry.numeric)}`).join(' ');
  if (weekly.length > 1) svg += `<polygon points="${x(weekly[0].date)},${pad.t+plotH} ${points} ${x(weekly[weekly.length-1].date)},${pad.t+plotH}" fill="url(#overallRankFill)"/>`;
  if (weekly.length > 1) svg += `<polyline class="rank-line" points="${points}"/>`;
  weekly.forEach((entry) => { svg += `<circle class="rank-point" cx="${x(entry.date)}" cy="${y(entry.numeric)}" r="3.5"><title>Week of ${formatDate(entry.date)} · Average rank #${Math.round(entry.numeric)} · ${entry.count} result${entry.count === 1 ? '' : 's'}</title></circle>`; });
  const labels = [weekly[0].date, weekly[Math.floor((weekly.length - 1) / 2)].date, weekly[weekly.length - 1].date].filter((date, i, arr) => arr.indexOf(date) === i);
  labels.forEach((date) => { const [, month, day] = date.split('-').map(Number); svg += `<text x="${x(date)}" y="${H-15}" text-anchor="middle">${MONTHS_SHORT[month-1]} ${day}</text>`; });
  svg += '</svg>';
  chart.style.width = `${W}px`; chart.style.minWidth = `${W}px`;
  chart.innerHTML = svg;
};

const overallToggleBtn = document.getElementById('overallToggleBtn');
if (overallToggleBtn) {
  overallToggleBtn.onclick = () => {
    showOverallLost = !showOverallLost;
    overallToggleBtn.classList.toggle('active', showOverallLost);
    overallToggleBtn.innerHTML = rewardToggleLabel(
      showOverallLost ? 'Show gained rewards' : 'Show lost rewards',
    );
    const overallBox = document.getElementById('overallTotalsBox');
    if (overallBox) overallBox.classList.toggle('lost', showOverallLost);
    const titleEl = document.getElementById('overallTotalsTitle');
    if (titleEl) {
      titleEl.classList.toggle('is-lost', showOverallLost);
      titleEl.textContent = showOverallLost
        ? 'Total rewards lost'
        : 'Total rewards gained';
    }
    renderOverall();
  };
}

activateSubTab = (tabsId, prefix, attr, key) => {
  const tabsEl = document.getElementById(tabsId);
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.season-tab').forEach((t) => {
    const on = t.dataset[attr] === key;
    t.classList.toggle('active', on);
  });
  ['bosses', 'totals', 'progress', 'stats'].forEach((k) => {
    const el = document.getElementById(prefix + k);
    if (el) el.style.display = k === key ? '' : 'none';
  });
};

const wirePanelSubTabs = (tabsId, prefix, attr) => {
  const tabsEl = document.getElementById(tabsId);
  if (!tabsEl || tabsEl.dataset.wired) return;
  tabsEl.dataset.wired = '1';
  tabsEl.querySelectorAll('.season-tab').forEach((btn) => {
    btn.onclick = () => {
      activateSubTab(tabsId, prefix, attr, btn.dataset[attr]);
    };
  });
};
wirePanelSubTabs('overallSubTabs', 'overallSub-', 'osub');
wirePanelSubTabs('seasonSubTabs', 'seasonSub-', 'ssub');

let historySeasonFilter = 'all';

const renderHistorySeasonTabs = () => {
  const seasons = loadSeasons();
  const tabsEl = document.getElementById('historySeasonTabs');
  if (!tabsEl) return;
  tabsEl.classList.add('season-tabs-picks');
  const items = [
    { id: 'all', label: 'All seasons' },
    ...[...seasons]
      .reverse()
      .map((s) => ({ id: s.id, label: seasonLabel(s) })),
  ];
  if (
    historySeasonFilter !== 'all' &&
    !seasons.find((s) => s.id === historySeasonFilter)
  ) {
    historySeasonFilter = 'all';
  }
  tabsEl.innerHTML = items
    .map((it) => {
      const active = it.id === historySeasonFilter ? ' active' : '';
      const pick = ' season-pick';
      return `<button class="season-tab${pick}${active}" data-hid="${it.id}">${it.label}</button>`;
    })
    .join('');
  tabsEl.querySelectorAll('.season-tab').forEach((btn) => {
    btn.onclick = () => {
      historySeasonFilter = btn.dataset.hid;
      renderHistory();
    };
  });
};

const renderHistory = () => {
  const days = loadDays();
  const seasons = loadSeasons();
  renderHistorySeasonTabs();

  let allDates = Object.keys(days).sort().reverse();
  if (historySeasonFilter !== 'all') {
    const season = seasons.find((s) => s.id === historySeasonFilter);
    if (season) {
      const range = getSeasonDateRange(seasons, season);
      allDates = allDates.filter((d) => dayInSeason(d, range));
    }
  }

  const wrap = document.getElementById('historyTableWrap');
  const searchEl = document.getElementById('historySearch');
  const hintEl = document.getElementById('historySearchHint');
  const q = (searchEl?.value || '').trim().toLowerCase();

  const dates = q
    ? allDates.filter((d) => historyMatchesQuery(d, days[d], seasons, q))
    : allDates;

  if (hintEl) {
    if (!allDates.length) {
      hintEl.textContent = '';
    } else if (q) {
      hintEl.textContent = `${dates.length} of ${allDates.length} day${allDates.length === 1 ? '' : 's'}`;
    } else {
      hintEl.textContent = `${allDates.length} day${allDates.length === 1 ? '' : 's'}`;
    }
  }

  if (!Object.keys(days).length) {
    wrap.innerHTML = '<div class="empty">No days logged yet.</div>';
    return;
  }
  if (!allDates.length) {
    wrap.innerHTML =
      '<div class="empty">No days logged in this season.</div>';
    return;
  }
  if (!dates.length) {
    wrap.innerHTML = `<div class="empty">No days match “${q}”.</div>`;
    return;
  }
  let html = `<div class="history-scroll"><table><thead><tr>
<th>Season day</th>
<th>Date</th>
<th>Dream Realm Boss</th>
${Object.keys(MODES)
  .map((k) => `<th>${MODES[k].label}</th>`)
  .join('')}<th></th>
    </tr></thead><tbody>`;
  dates.forEach((date) => {
    const d = days[date];
    let totalLost = 0;
    const rankCells = Object.keys(MODES)
      .map((key) => {
        if (key === 'supremeArena' && d.saOff) {
          return '<td class="bracket-note" style="color:var(--muted)">Not a reward day</td>';
        }
        if (
          (key === 'dreamHunt' && !d.dhRewardDay) ||
          (key === 'supremeLeague' && !d.slRewardDay)
        ) {
          const off =
            key === 'supremeLeague' && d.slNoQual
              ? 'Did not qualify'
              : 'Not a reward day';
          return `<td class="bracket-note" style="color:var(--muted)">${off}</td>`;
        }
        const rank = d.ranks[key];
        if (!rank) return '<td class="bracket-note">-</td>';
        const { lost } = computeLost(key, rank);
        totalLost += Object.values(lost).reduce((a, b) => a + b, 0);
        const idx = getBracketIndex(key, rank);
        const c =
          idx === -1
            ? 'var(--red)'
            : tierColorForIndex(idx, MODES[key].brackets.length);
        return `<td style="color: ${c}; font-weight: 700;">${rankText(key, rank)}</td>`;
      })
      .join('');
    const bossName = escapeHtml(d.boss || bossForDate(date) || '—');
    const season = findSeasonForDate(date, seasons);
    const dayNum = season ? seasonDayNumber(date, season.start) : null;
    const dayLabel = dayNum
      ? `Day ${dayNum}${season ? `<span class="hist-season"> · ${seasonLabel(season)}</span>` : ''}`
      : '-';
    html += `<tr>
  <td style="color:var(--muted);font-size:12px;white-space:nowrap">${dayLabel}</td>
  <td style="white-space:nowrap">${formatDate(date)}</td>
  <td style="color: var(--cyan); font-weight: 600;">${bossName}</td>
  ${rankCells}
  <td style="white-space:nowrap">
    <button class="edit-btn" onclick="editDay('${date}')" title="Edit this day">✎</button>
    <button class="del-btn" onclick="deleteDay('${date}')" title="Delete">🗑</button>
  </td>
</tr>`;
  });
  html += '</tbody></table></div>';
  wrap.innerHTML = html;
};

document.getElementById('historySearch').addEventListener('input', () => {
  renderHistory();
});

// Open a logged day on the Daily log tab for editing
window.editDay = (date) => {
  document
    .querySelectorAll('.tab')
    .forEach((t) => t.classList.remove('active'));
  document
    .querySelectorAll('.view')
    .forEach((v) => v.classList.remove('active'));
  const todayTab = document.querySelector('.tab[data-view="today"]');
  if (todayTab) todayTab.classList.add('active');
  const view = document.getElementById('view-today');
  if (view) view.classList.add('active');

  const entryDateEl = document.getElementById('entryDate');
  if (entryDateEl) {
    entryDateEl.value = date;
    const label = document.getElementById('entryDateLabel');
    if (label) label.textContent = formatDate(date);
    preloadToday();
  }
  // Bring the daily form into view
  const formCard = document.querySelector('#view-today .card');
  if (formCard) {
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

let pendingDeleteDayDate = null;
const deleteDayModal = document.getElementById('deleteDayModal');
const deleteDayMsg = document.getElementById('deleteDayMsg');

window.deleteDay = (date) => {
  if (!loadDays()[date]) return;
  pendingDeleteDayDate = date;
  deleteDayMsg.textContent = `This will permanently delete the rankings logged for ${formatDate(date)}. This action cannot be undone.`;
  deleteDayModal.hidden = false;
};

document.getElementById('modalDeleteDayCancel').onclick = () => {
  deleteDayModal.hidden = true;
  pendingDeleteDayDate = null;
};
document.getElementById('modalDeleteDayConfirm').onclick = () => {
  if (!pendingDeleteDayDate) return;
  const date = pendingDeleteDayDate;
  const days = loadDays();
  delete days[date];
  saveDays(days);
  deleteDayModal.hidden = true;
  pendingDeleteDayDate = null;
  renderHistory();
  renderOverall();
  renderSeason();
  // If this date is open in Daily Log, clear its inputs and results too.
  if (document.getElementById('entryDate').value === date) {
    preloadToday();
  }
};

let activeSeasonId = null;
let pendingDeleteSeasonId = null;

selectCurrentSeason = () => {
  const seasons = loadSeasons();
  if (!seasons.length) return;
  const stored = getActiveSeasonId();
  if (stored && seasons.find((s) => s.id === stored)) {
    activeSeasonId = stored;
  } else {
    // fall back to the latest season by start date
    const sorted = [...seasons].sort((a, b) =>
      a.start.localeCompare(b.start),
    );
    activeSeasonId = sorted[sorted.length - 1].id;
  }
  setActiveSeasonId(activeSeasonId);
};

const renderSeasonTabs = (seasons) => {
  const tabsEl = document.getElementById('seasonTabs');
  tabsEl.classList.add('season-tabs-picks');
  tabsEl.style.display = seasons.length ? '' : 'none';
  if (!seasons.length) {
    tabsEl.innerHTML = '';
    return;
  }
  if (!activeSeasonId || !seasons.find((s) => s.id === activeSeasonId)) {
    activeSeasonId = seasons[seasons.length - 1].id;
    setActiveSeasonId(activeSeasonId);
  }
  const ordered = [...seasons].reverse();
  tabsEl.innerHTML = ordered
    .map((s) => {
      const active = s.id === activeSeasonId ? ' active' : '';
      const editBtn = `<button class="season-edit" data-edit-sid="${s.id}" title="Edit season">✎</button>`;
      const delBtn = `<button class="season-del" data-del-sid="${s.id}" title="Delete season">🗑</button>`;
      return `<span class="season-tab-wrap">
      <button class="season-tab season-pick${active}" data-sid="${s.id}">
        ${seasonLabel(s)}
      </button>${editBtn}${delBtn}
    </span>`;
    })
    .join('');
  tabsEl.querySelectorAll('.season-tab').forEach((btn) => {
    btn.onclick = () => {
      activeSeasonId = btn.dataset.sid;
      setActiveSeasonId(activeSeasonId);
      renderSeason();
    };
  });
  tabsEl.querySelectorAll('.season-edit').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openSeasonEditor(btn.dataset.editSid);
    };
  });
  tabsEl.querySelectorAll('.season-del').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openDeleteSeasonModal(btn.dataset.delSid);
    };
  });
};

const updateSeasonTotalsTitle = (season) => {
  const titleEl = document.getElementById('seasonTotalsTitle');
  if (!titleEl) return;
  titleEl.style.color = showSeasonLost ? 'var(--red)' : 'var(--green)';
  const seasonBox = document.getElementById('seasonTotalsBox');
  if (seasonBox) seasonBox.classList.toggle('lost', showSeasonLost);
  titleEl.classList.toggle('is-lost', showSeasonLost);
  titleEl.innerHTML = `Rewards ${showSeasonLost ? 'lost' : 'gained'} in <span class="reward-season-name">${goldName(seasonLabel(season) || 'this season')}</span>`;
};

let seasonProgressSelectedMode = '';
const renderSeasonProgress = (days, filterFn, range) => {
  const select = document.getElementById('seasonProgressMode');
  const chart = document.getElementById('seasonProgressChart');
  const summary = document.getElementById('seasonProgressSummary');
  const recap = document.getElementById('seasonProgressRecap');
  if (!select || !chart || !summary) return;
  const modeKeys = Object.keys(MODES).filter((key) =>
    Object.keys(days).some((date) => filterFn(date) && days[date].ranks && days[date].ranks[key] != null && (key !== 'supremeLeague' || rankNumText(key, days[date].ranks[key]) != null)),
  );
  const availableKeys = modeKeys.length ? modeKeys : Object.keys(MODES);
  const previous = seasonProgressSelectedMode || select.value;
  select.innerHTML = availableKeys.map((key) => `<option value="${key}">${MODES[key].label}</option>`).join('');
  select.value = availableKeys.includes(previous) ? previous : availableKeys[0];
  seasonProgressSelectedMode = select.value;
  select.onchange = () => { seasonProgressSelectedMode = select.value; renderSeasonProgress(days, filterFn, range); };
  const modeKey = select.value;
  const entries = Object.keys(days).sort().filter((date) => {
    const d = days[date];
    return filterFn(date) && d.ranks && d.ranks[modeKey] != null && (modeKey !== 'supremeLeague' || rankNumText(modeKey, d.ranks[modeKey]) != null);
  }).map((date) => {
    const raw = days[date].ranks[modeKey];
    const display = rankText(modeKey, raw);
    const numeric = modeKey === 'supremeLeague' ? Number((rankNumText(modeKey, raw) || '').replace('#', '')) : Number(raw);
    return { date, raw, display, numeric };
  }).filter((p) => Number.isFinite(p.numeric) && p.numeric > 0);
  if (!entries.length) {
    summary.innerHTML = '<div class="season-progress-stat"><div class="season-progress-stat-label">No rankings yet</div><div class="season-progress-stat-value" style="font-size:15px">Nothing to chart</div><div class="season-progress-stat-detail">Add a daily rank for this mode.</div></div>';
    if (recap) { recap.style.display = 'none'; recap.innerHTML = ''; }
    chart.style.width = '100%'; chart.style.minWidth = '0';
    chart.innerHTML = '<div class="empty-state" style="padding: 28px 12px">Your ranking history will appear here once you log a rank.</div>';
    return;
  }
  const best = entries.reduce((a, b) => a.numeric < b.numeric ? a : b);
  const worst = entries.reduce((a, b) => a.numeric > b.numeric ? a : b);
  const last = entries[entries.length - 1];
  const stat = (label, value, detail='') => `<div class="season-progress-stat"><div class="season-progress-stat-label">${label}</div><div class="season-progress-stat-value">${value}</div>${detail ? `<div class="season-progress-stat-detail">${detail}</div>` : ''}</div>`;
  const average = (items) => items.reduce((sum, p) => sum + p.numeric, 0) / items.length;
  const avgLabel = (n) => `#${n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  let trendValue = 'Not enough data';
  let trendDetail = 'Need at least 2 results in each 7-day period';
  let trendClass = 'neutral';
  let trendLabel = 'Season trend · 1-week average';
  if (modeKey === 'supremeLeague') {
    // Supreme League rewards are periodic, not weekly: compare the two latest recorded events.
    trendLabel = 'Season trend · between events';
    trendDetail = 'Need at least 2 recorded Supreme League results';
    if (entries.length >= 2) {
      const previous = entries[entries.length - 2];
      const current = entries[entries.length - 1];
      const improvement = previous.numeric - current.numeric;
      const changePercent = previous.numeric > 0 ? (improvement / previous.numeric) * 100 : 0;
      if (changePercent >= 5) { trendValue = 'Improving ↑'; trendClass = 'positive'; }
      else if (changePercent <= -5) { trendValue = 'Declining ↓'; trendClass = 'negative'; }
      else { trendValue = 'Stable →'; trendClass = 'neutral'; }
      trendDetail = `<span class="recap-headline">Rank <span class="rank-value">${previous.display}</span> → <span class="season-trend-${trendClass}">${current.display}</span></span><span class="season-progress-stat-detail">Compared with your previous recorded event</span>`;
    }
  } else {
    // Compare average ranks in two adjacent 7-calendar-day windows, anchored on the latest result.
    const latestMs = Date.parse(last.date + 'T12:00:00Z');
    const ageInDays = (p) => Math.round((latestMs - Date.parse(p.date + 'T12:00:00Z')) / 86400000);
    const recentEntries = entries.filter((p) => ageInDays(p) >= 0 && ageInDays(p) <= 6);
    const previousEntries = entries.filter((p) => ageInDays(p) >= 7 && ageInDays(p) <= 13);
    if (recentEntries.length >= 2 && previousEntries.length >= 2) {
      const recentAvg = average(recentEntries);
      const previousAvg = average(previousEntries);
      const improvement = previousAvg - recentAvg;
      const changePercent = previousAvg > 0 ? (improvement / previousAvg) * 100 : 0;
      if (changePercent >= 5) { trendValue = 'Improving ↑'; trendClass = 'positive'; }
      else if (changePercent <= -5) { trendValue = 'Declining ↓'; trendClass = 'negative'; }
      else { trendValue = 'Stable →'; trendClass = 'neutral'; }
      trendDetail = `<span class="recap-headline">Average rank <span class="rank-value">${avgLabel(previousAvg)}</span> → <span class="season-trend-${trendClass}">${avgLabel(recentAvg)}</span></span>`;
    }
  }
  const seasonAverage = entries.reduce((sum, entry) => sum + entry.numeric, 0) / entries.length;
  const seasonAverageLabel = `#${Math.round(seasonAverage).toLocaleString('en-US')}`;
  summary.innerHTML = stat('Average rank', seasonAverageLabel, `${entries.length} recorded result${entries.length === 1 ? '' : 's'}`) + stat('Best rank', best.display, formatDate(best.date)) + stat('Worst rank', worst.display, formatDate(worst.date)) + stat(trendLabel, `<span class="season-trend-${trendClass}">${trendValue}</span>`, trendDetail);
  const seasonEnded = Boolean(range && range.end && todayStr() > range.end);
  if (recap) {
    if (seasonEnded) {
      const seasonRecap = buildSeasonRecap(modeKey, entries, range);
      recap.innerHTML = `<div class="season-progress-recap-title">Season recap · ${MODES[modeKey].label}</div><div class="season-progress-recap-main">${colorRecapHeadline(seasonRecap.headline)}</div><div class="season-progress-recap-detail">${seasonRecap.detail}</div>`;
      recap.style.display = '';
    } else {
      recap.style.display = 'none';
      recap.innerHTML = '';
    }
  }
  const W = Math.max(800, Math.min(2400, entries.length * 24 + 76)), H = 300;
  const pad = { l: 54, r: 22, t: 20, b: 42 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const vals = entries.map((p) => p.numeric);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min = Math.max(1, min * 0.7); max = max * 1.3 + 1; }
  const yMin = Math.max(1, min - (max - min) * 0.12), yMax = max + (max - min) * 0.12;
  const startMs = Date.parse((range.start || entries[0].date) + 'T12:00:00Z');
  const endMs = Date.parse((range.end || (todayStr() > entries[entries.length-1].date ? todayStr() : entries[entries.length-1].date)) + 'T12:00:00Z');
  const span = Math.max(86400000, endMs - startMs);
  const x = (date) => pad.l + ((Date.parse(date + 'T12:00:00Z') - startMs) / span) * plotW;
  const y = (rank) => pad.t + ((rank - yMin) / (yMax - yMin)) * plotH;
  const ticks = 4;
  let svg = `<svg class="season-progress-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rank progression for ${MODES[modeKey].label}"><defs><linearGradient id="seasonRankFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8c244" stop-opacity=".20"/><stop offset="100%" stop-color="#f8c244" stop-opacity="0"/></linearGradient></defs>`;
  // Reverse vertical mapping so smaller rank numbers appear higher.
  const yRank = (rank) => pad.t + ((yMax - rank) / (yMax - yMin)) * plotH;
  for (let i = 0; i <= ticks; i++) {
    const value = yMin + ((yMax - yMin) * i / ticks), yy = yRank(value);
    svg += `<line class="gridline" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/><text x="${pad.l-10}" y="${yy+4}" text-anchor="end">#${Math.round(value)}</text>`;
  }
  const points = entries.map((p) => `${x(p.date)},${yRank(p.numeric)}`).join(' ');
  if (entries.length > 1) svg += `<polygon class="rank-area" points="${x(entries[0].date)},${pad.t + plotH} ${points} ${x(entries[entries.length-1].date)},${pad.t + plotH}"/>`;
  svg += `<polyline class="rank-line" points="${points}"/>`;
  entries.forEach((p) => {
    const xx = x(p.date), yy = yRank(p.numeric);
    const seasonDay = seasonDayNumber(p.date, range.start);
    svg += `<circle class="rank-point" cx="${xx}" cy="${yy}" r="4.5"><title>${formatDate(p.date)} · Season Day ${seasonDay} · Rank ${p.display}</title></circle>`;
  });
  // Keep the plotted line tied to real recorded results, but label the full
  // season boundaries on the x-axis even when they aren't 7 days apart
  // from the nearest weekly/result label.
  const chartStartDate = range.start || entries[0].date;
  const chartEndDate = range.end || (todayStr() > entries[entries.length - 1].date ? todayStr() : entries[entries.length - 1].date);
  const middleDate = entries[Math.floor((entries.length - 1) / 2)].date;
  const dateLabels = [chartStartDate, middleDate, chartEndDate].filter((d, i, a) => a.indexOf(d) === i);
  dateLabels.forEach((date, i) => {
    const [, month, day] = date.split('-').map(Number);
    const shortDate = `${MONTHS_SHORT[month - 1]} ${day}`;
    const anchor = date === chartStartDate ? 'start' : date === chartEndDate ? 'end' : 'middle';
    const labelX = date === chartStartDate ? pad.l : date === chartEndDate ? W - pad.r : x(date);
    svg += `<text x="${labelX}" y="${H-15}" text-anchor="${anchor}">${shortDate}</text>`;
  });
  svg += '</svg>';
  chart.style.width = `${W}px`; chart.style.minWidth = `${W}px`;
  chart.innerHTML = svg;
};

const renderSeason = () => {
  const seasons = loadSeasons();
  renderSeasonTabs(seasons);
  const emptyEl = document.getElementById('seasonEmpty');
  const contentEl = document.getElementById('seasonContent');
  const hasSeasons = seasons.length > 0;
  if (emptyEl) emptyEl.hidden = hasSeasons;
  if (contentEl) contentEl.hidden = !hasSeasons;
  const season =
    seasons.find((s) => s.id === activeSeasonId) || seasons[0];
  if (!season) {
    renderSeasonInfoBar(null, null);
    return;
  }
  const range = getSeasonDateRange(seasons, season);
  renderSeasonInfoBar(season, range);
  const days = loadDays();
  const filterFn = (d) => dayInSeason(d, range);

  updateSeasonTotalsTitle(season);

  const seasonName = seasonLabel(season) || 'this season';
  const progressSubnoteName = document.getElementById('seasonProgressSubnoteName');
  if (progressSubnoteName) progressSubnoteName.textContent = seasonName;

  const dist = computeBracketDist(days, filterFn, showSeasonLost);
  renderDist(
    document.getElementById('seasonDist'),
    dist,
    showSeasonLost,
    'this season',
  );
  renderBossBracketDist(
    document.getElementById('seasonBossWrap'),
    computeBossBracketDist(days, filterFn),
  );
  const totals = computeTotalsForDays(days, filterFn);
  renderTotalsGrid(
    document.getElementById('seasonGrid'),
    totals,
    showSeasonLost,
    'this season',
  );
  renderSeasonProgress(days, filterFn, range);
};

const seasonToggleBtn = document.getElementById('seasonToggleBtn');
if (seasonToggleBtn) {
  seasonToggleBtn.onclick = () => {
    showSeasonLost = !showSeasonLost;
    seasonToggleBtn.classList.toggle('active', showSeasonLost);
    seasonToggleBtn.innerHTML = rewardToggleLabel(
      showSeasonLost ? 'Show gained rewards' : 'Show lost rewards',
    );
    renderSeason();
  };
}

const newSeasonModal = document.getElementById('newSeasonModal');
const modalSeasonName = document.getElementById('modalSeasonName');
const modalSeasonStart = document.getElementById('modalSeasonStart');
const modalSeasonStartLabel = document.getElementById(
  'modalSeasonStartLabel',
);
const syncModalStartLabel = () => {
  modalSeasonStartLabel.textContent = formatDate(
    modalSeasonStart.value || todayStr(),
  );
};

const modalSeasonTitle = document.getElementById('modalSeasonTitle');
const modalSeasonDesc = document.getElementById('modalSeasonDesc');
// When the first-ever "Save day" opens the modal, the save finishes
// once the season has been created.
let pendingSaveAfterSeason = false;
let pendingSaveAfterRotation = false;

// Defaults shown in the season popup (first-ever day, or "+ New season"):
// they come from the newest block in SEASON_BLOCKS. The name is only a
// placeholder hint; the start date is pre-filled.
const DEFAULT_SEASON_NAME_HINT = `e.g. S${LATEST_SEASON_BLOCK.number} - ${LATEST_SEASON_BLOCK.name}`;
const DEFAULT_SEASON_START = LATEST_SEASON_BLOCK.start;

const openNewSeasonModal = (startDate) => {
  // one window: step 1 (season) now, step 2 (boss rotation) after Next
  brMode = 'create';
  brSeasonId = null;
  brDraft = null;
  brTouched = false;
  brAnchorTouched = false;
  document.getElementById('modalSeasonHint').hidden = true;
  document.getElementById('seasonStep1Label').hidden = false;
  document.getElementById('modalSeasonSave').hidden = true;
  document.getElementById('modalSeasonConfirm').className = 'primary';
  const nextHint = document.getElementById('modalSeasonNextHint');
  if (nextHint) nextHint.hidden = true;
  openSeasonPane(1);
  const seasons = loadSeasons();
  const isFirst = seasons.length === 0;
  if (isFirst) {
    // empty field so the placeholder hint shows
    modalSeasonName.value = '';
    modalSeasonName.placeholder = DEFAULT_SEASON_NAME_HINT;
    modalSeasonTitle.textContent = 'Add your first season';
    modalSeasonDesc.textContent =
      'Enter the season you want to track and the date it started. Days from the start date onward count toward it. You can add the next season when it begins.';
  } else {
    modalSeasonName.value = '';
    modalSeasonName.placeholder = DEFAULT_SEASON_NAME_HINT;
    modalSeasonTitle.textContent = 'Start a new season';
    modalSeasonDesc.textContent =
      'Previous seasons stay available. Days from the start date onward count toward the new season.';
  }
  // From the Daily log the picked date is the start date. From the
  // Seasons tab it is the newest block's start, unless a season already
  // starts that day (then today).
  modalSeasonStart.value =
    startDate ||
    (seasons.some((x) => x.start === DEFAULT_SEASON_START)
      ? todayStr()
      : DEFAULT_SEASON_START);
  syncModalStartLabel();
  newSeasonModal.hidden = false;
  modalSeasonName.focus();
};
document.getElementById('newSeasonBtn').onclick = () =>
  openNewSeasonModal();
document.getElementById('seasonEmptyAddBtn').onclick = () =>
  openNewSeasonModal();
document.getElementById('modalSeasonStart').onchange =
  syncModalStartLabel;
document.getElementById('modalSeasonStart').oninput = syncModalStartLabel;
document
  .getElementById('modalSeasonStartBtn')
  .addEventListener('click', () => {
    if (typeof modalSeasonStart.showPicker === 'function') {
      try {
        modalSeasonStart.showPicker();
        return;
      } catch (e) {}
    }
    modalSeasonStart.focus();
    modalSeasonStart.click();
  });

// ---- Season + boss rotation popup (one window, two steps) ----
// 'create': step 1 = name and start date, step 2 = boss rotation. Nothing
//   is saved until the last button, so cancelling leaves nothing behind.
// 'edit': only the rotation pane, for a season that already exists.
const seasonPane1 = document.getElementById('seasonPane1');
const seasonPane2 = document.getElementById('seasonPane2');
const brListEl = document.getElementById('brList');
const brAnchorEl = document.getElementById('brAnchor');
const brAddNameEl = document.getElementById('brAddName');
const brBackBtn = document.getElementById('brBack');
const brSaveBtn = document.getElementById('brSave');
// 'create': new season (name/date, then rotation)
// 'season': edit an existing season (name/date, optionally the rotation)
// 'rotation': only the rotation pane (asked for when saving a day)
let brMode = 'rotation';
let brSeasonId = null; // edit mode: the season being edited
let brDraft = null; // create mode: { name, start, number }
let brTouched = false; // the player changed the list or the date
let brAnchorTouched = false; // the player picked the cycle date themselves
let brStart = ''; // start date of the season being set up
let brOrder = [];
const openSeasonPane = (n) => {
  seasonPane1.hidden = n !== 1;
  seasonPane2.hidden = n !== 2;
};
// another season that already starts on this date (exceptId = ignore one)
const seasonStartConflict = (start, exceptId) =>
  loadSeasons().find((x) => x.start === start && x.id !== exceptId);
const startConflictText = (start, other) =>
  seasonLabel(other) +
  ' already starts on ' +
  formatDate(start) +
  '. Pick a different start date.';
const brSetHint = (msg) => {
  const el = document.getElementById('brHint');
  el.textContent = msg || '';
  el.hidden = !msg;
};
const renderBossRotationModal = () => {
  brListEl.innerHTML = '';
  if (!brOrder.length) {
    brListEl.innerHTML =
      '<div class="br-row" style="color:var(--muted)">No bosses yet. Add the bosses in the order they appear.</div>';
  }
  brOrder.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'br-row';
    const day = document.createElement('span');
    day.className = 'br-day';
    day.textContent = 'Day ' + (i + 1);
    const nm = document.createElement('span');
    nm.className = 'br-name';
    nm.textContent = name;
    row.append(day, nm);
    const mk = (label, aria, cls, fn, disabled) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', aria);
      if (cls) b.className = cls;
      b.disabled = !!disabled;
      if (disabled) b.style.opacity = '0.35';
      b.onclick = () => {
        brTouched = true;
        fn();
      };
      return b;
    };
    row.append(
      mk(
        '↑',
        'Move up',
        '',
        () => {
          [brOrder[i - 1], brOrder[i]] = [brOrder[i], brOrder[i - 1]];
          renderBossRotationModal();
        },
        i === 0,
      ),
      mk(
        '↓',
        'Move down',
        '',
        () => {
          [brOrder[i + 1], brOrder[i]] = [brOrder[i], brOrder[i + 1]];
          renderBossRotationModal();
        },
        i === brOrder.length - 1,
      ),
      mk(
        '✕',
        'Remove boss',
        'br-remove',
        () => {
          brOrder.splice(i, 1);
          renderBossRotationModal();
        },
        false,
      ),
    );
    brListEl.appendChild(row);
  });
  // preview: the first 5 days of the season, so a cycle date that
  // doesn't fit the season shows up straight away
  const prev = document.getElementById('brPreview');
  prev.innerHTML = '';
  if (brOrder.length && brAnchorEl.value) {
    for (let i = 0; i < 5; i++) {
      const d = new Date((brStart || brAnchorEl.value) + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      const ds = d.toISOString().slice(0, 10);
      const cell = document.createElement('div');
      const sm = document.createElement('small');
      sm.textContent = formatDate(ds).replace(/, \d{4}$/, '');
      const bb = document.createElement('b');
      bb.textContent = bossFromRotation(
        { anchor: brAnchorEl.value, order: brOrder },
        ds,
      );
      cell.append(sm, bb);
      prev.appendChild(cell);
    }
  }
};
// The same rotation, but with the cycle starting on the season's first
// day: the list is rotated so the boss of that day comes first. Every
// date keeps the same boss; only the cycle date no longer lies before
// the season (e.g. a default that began before this season started).
const rotationAtStart = (rot, start) => {
  if (!rot || !start || rot.anchor >= start) return rot;
  const n = rot.order.length;
  const idx = ((daysBetween(rot.anchor, start) % n) + n) % n;
  return {
    ...rot,
    anchor: start,
    order: [...rot.order.slice(idx), ...rot.order.slice(0, idx)],
  };
};
// Fill the editor for a season (a real one, or the create-mode draft):
// its saved/default rotation, else the known bosses from the season start.
const brPrefill = (season) => {
  const rot = rotationAtStart(rotationFor(season), season.start);
  brOrder = rot ? [...rot.order] : [...LATEST_SEASON_BLOCK.bosses];
  // Cycle start: the player's own date, else the site default's date for
  // this season, else the day the season starts.
  brStart = season.start;
  brAnchorEl.min = brStart;
  brAnchorEl.value = rot ? rot.anchor : season.start;
  brAnchorTouched = false;
  let desc = rot
    ? 'Bosses repeat in this order. The first boss in the list is the boss on the cycle start date.'
    : "This season's rotation isn't set yet. Put the bosses in the order they appear, and pick the cycle start date: the first boss in the list is the boss on that date.";
  if (brMode === 'rotation' && pendingSaveAfterRotation) {
    desc =
      'Last step: set the boss order for this season. The first boss in the list is the boss on the cycle start date. Your day is saved when you press Save.';
  } else if (brMode === 'create' && pendingSaveAfterSeason) {
    desc += ' Your day is saved when you finish.';
  }
  document.getElementById('brDesc').textContent = desc;
  brAddNameEl.value = '';
  brSetHint('');
  renderBossRotationModal();
};
// Edit the rotation of a season that already exists (only pane 2)
const openBossRotationModal = (seasonId) => {
  const season = loadSeasons().find((x) => x.id === seasonId);
  if (!season) return;
  brMode = 'rotation';
  brSeasonId = seasonId;
  brDraft = null;
  brTouched = false;
  brPrefill(season);
  document.getElementById('brTitle').textContent =
    'Boss rotation · ' + seasonLabel(season);
  document.getElementById('seasonStep2Label').hidden = true;
  brBackBtn.hidden = true;
  document.getElementById('brNote').hidden = false;
  brSaveBtn.textContent = pendingSaveAfterRotation
    ? 'Save rotation & day'
    : 'Save rotation';
  openSeasonPane(2);
  newSeasonModal.hidden = false;
};
// Step 1 -> step 2 of creating a season (nothing is saved yet)
document.getElementById('modalSeasonConfirm').onclick = () => {
  const editing = brMode === 'season';
  const name =
    modalSeasonName.value.trim() || (editing ? 'Season' : 'New Season');
  const start = modalSeasonStart.value || todayStr();
  const clash = seasonStartConflict(start, editing ? brSeasonId : null);
  const startHint = document.getElementById('modalSeasonHint');
  if (clash) {
    startHint.textContent = startConflictText(start, clash);
    startHint.hidden = false;
    return;
  }
  startHint.hidden = true;
  const number = numberFromName(name) ?? seasonNumberForDate(start);
  // (when editing, the id lets the draft find the season's own rotation)
  brDraft = { id: editing ? brSeasonId : undefined, name, start, number };
  brStart = start;
  brAnchorEl.min = start;
  // coming back from "Back" keeps edits; otherwise refresh the
  // suggestion, because the season number picks the site default
  if (!brTouched) {
    brPrefill(brDraft);
  } else {
    if (!brAnchorTouched) {
      // list was edited but the date is still the suggested one: let it
      // follow the (possibly changed) season start
      const rot = rotationFor(brDraft);
      brAnchorEl.value = rot && rot.anchor >= start ? rot.anchor : start;
    }
    renderBossRotationModal();
  }
  document.getElementById('brTitle').textContent =
    'Boss rotation · ' + name;
  document.getElementById('seasonStep2Label').hidden = editing;
  brBackBtn.hidden = false;
  document.getElementById('brNote').hidden = !editing;
  brSaveBtn.textContent = editing
    ? 'Save'
    : pendingSaveAfterSeason
      ? 'Create season & save day'
      : 'Create season';
  openSeasonPane(2);
};
modalSeasonName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // editing: Enter = the quick Save; creating: Enter = Next
    document
      .getElementById(
        brMode === 'season' ? 'modalSeasonSave' : 'modalSeasonConfirm',
      )
      .click();
  }
});
brBackBtn.onclick = () => openSeasonPane(1);
brAnchorEl.addEventListener('change', () => {
  brTouched = true;
  brAnchorTouched = true;
  brSetHint('');
  // the cycle can't start before the season does
  if (brStart && brAnchorEl.value && brAnchorEl.value < brStart) {
    brAnchorEl.value = brStart;
    brSetHint(
      "The cycle can't start before the season (" +
        formatDate(brStart) +
        ').',
    );
  }
  renderBossRotationModal();
});
const brAddBoss = () => {
  const typed = cleanBoss(brAddNameEl.value);
  if (!typed) {
    brSetHint('Type a boss name first.');
    return;
  }
  // same name ignoring capitals / extra spaces -> reuse known spelling
  const known = knownBossNames().find(
    (n) => normBoss(n) === normBoss(typed),
  );
  const name = known || typed;
  const dup = brOrder.find((b) => normBoss(b) === normBoss(name));
  if (dup) {
    brSetHint(dup + ' is already in this rotation.');
    return;
  }
  brTouched = true;
  brOrder.push(name);
  brAddNameEl.value = '';
  brSetHint('');
  renderBossRotationModal();
};
document.getElementById('brAddBtn').onclick = brAddBoss;
brAddNameEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    brAddBoss();
  }
});
// Close the window. When it is cancelled, a day that was waiting for
// the season / rotation is not saved.
const closeSeasonModal = (cancelled) => {
  newSeasonModal.hidden = true;
  brSeasonId = null;
  brDraft = null;
  brTouched = false;
  brAnchorTouched = false;
  if (!cancelled) return;
  pendingSaveAfterSeason = false;
  pendingSaveAfterRotation = false;
};
document.getElementById('modalSeasonCancel').onclick = () =>
  closeSeasonModal(true);
document.getElementById('brCancel').onclick = () =>
  closeSeasonModal(true);
newSeasonModal.addEventListener('click', (e) => {
  if (e.target === newSeasonModal) closeSeasonModal(true);
});
// days already logged in a season follow its rotation
const brApplyToLoggedDays = (seasons, season) => {
  const range = getSeasonDateRange(seasons, season);
  const rot = rotationFor(season);
  const days = loadDays();
  let changed = false;
  Object.keys(days).forEach((date) => {
    if (!dayInSeason(date, range) || !rot) return;
    const b = bossFromRotation(rot, date);
    if (days[date].boss !== b) {
      days[date].boss = b;
      changed = true;
    }
  });
  if (changed) saveDays(days);
};
// After a start date moves, some days belong to another season: give
// them the boss of their new season's rotation (only seasons whose
// rotation was set by the player; others keep the boss they were saved
// with).
const reapplyBossesForMovedDays = (oldSeasons, newSeasons) => {
  const days = loadDays();
  let changed = false;
  Object.keys(days).forEach((date) => {
    const before = findSeasonForDate(date, oldSeasons);
    const after = findSeasonForDate(date, newSeasons);
    if (!after || (before && before.id === after.id)) return;
    const rot = rotationFor(after);
    if (!rot || rot.source !== 'custom') return;
    const b = bossFromRotation(rot, date);
    if (days[date].boss !== b) {
      days[date].boss = b;
      changed = true;
    }
  });
  if (changed) saveDays(days);
};
// Edit an existing season: step 1 = name/date (Save is enough for a
// quick change), Next goes on to its boss rotation.
const openSeasonEditor = (seasonId) => {
  const season = loadSeasons().find((x) => x.id === seasonId);
  if (!season) return;
  brMode = 'season';
  brSeasonId = seasonId;
  brDraft = null;
  brTouched = false;
  brAnchorTouched = false;
  document.getElementById('modalSeasonHint').hidden = true;
  modalSeasonName.value = season.name || '';
  modalSeasonName.placeholder = DEFAULT_SEASON_NAME_HINT;
  modalSeasonTitle.textContent = 'Edit season';
  modalSeasonDesc.textContent = 'Change the season name or start date.';
  modalSeasonStart.value = season.start || todayStr();
  syncModalStartLabel();
  document.getElementById('seasonStep1Label').hidden = true;
  document.getElementById('modalSeasonSave').hidden = false;
  document.getElementById('modalSeasonConfirm').className = 'ghost';
  const nextHint = document.getElementById('modalSeasonNextHint');
  if (nextHint) nextHint.hidden = false;
  openSeasonPane(1);
  newSeasonModal.hidden = false;
  modalSeasonName.focus();
};
// Save on step 1 while editing: name and start date only
document.getElementById('modalSeasonSave').onclick = () => {
  if (brMode !== 'season' || !brSeasonId) return;
  const name = modalSeasonName.value.trim() || 'Season';
  const start = modalSeasonStart.value || todayStr();
  const clash = seasonStartConflict(start, brSeasonId);
  const startHint = document.getElementById('modalSeasonHint');
  if (clash) {
    startHint.textContent = startConflictText(start, clash);
    startHint.hidden = false;
    return;
  }
  const seasons = loadSeasons();
  const before = JSON.parse(JSON.stringify(seasons));
  const idx = seasons.findIndex((x) => x.id === brSeasonId);
  if (idx === -1) {
    closeSeasonModal(false);
    return;
  }
  seasons[idx] = {
    ...seasons[idx],
    name,
    start,
    number: numberFromName(name) ?? seasonNumberForDate(start),
  };
  seasons.sort((a, b) => a.start.localeCompare(b.start));
  saveSeasons(seasons);
  reapplyBossesForMovedDays(before, seasons);
  closeSeasonModal(false);
  brRefreshAfterSave();
};
const brRefreshAfterSave = () => {
  bossManualOverride = false;
  syncBossFromDate();
  renderHistory();
  renderOverall();
  renderSeason();
  updateSetupBanner();
};
// true when the editor holds something that can be saved
const brValid = () => {
  if (!brOrder.length) {
    brSetHint('Add at least one boss.');
    return false;
  }
  if (!brAnchorEl.value) {
    brSetHint('Pick the date the cycle starts on.');
    return false;
  }
  if (brStart && brAnchorEl.value < brStart) {
    brSetHint(
      "The cycle can't start before the season (" +
        formatDate(brStart) +
        ').',
    );
    return false;
  }
  return true;
};
brSaveBtn.onclick = () => {
  if (!brValid()) return;
  if (brMode === 'create') {
    if (!brDraft) return;
    const clash = seasonStartConflict(brDraft.start, null);
    if (clash) {
      brSetHint(startConflictText(brDraft.start, clash));
      return;
    }
    // create the season and its rotation together
    const seasons = loadSeasons();
    const id = 's_' + Date.now();
    const season = {
      id,
      name: brDraft.name,
      start: brDraft.start,
      number: brDraft.number,
    };
    seasons.push(season);
    seasons.sort((a, b) => a.start.localeCompare(b.start));
    saveSeasons(seasons);
    activeSeasonId = id;
    setActiveSeasonId(id);
    const custom = loadCustomRotations();
    custom[id] = { anchor: brAnchorEl.value, order: [...brOrder] };
    saveCustomRotations(custom);
    brApplyToLoggedDays(seasons, season);
    closeSeasonModal(false);
    brRefreshAfterSave();
    if (pendingSaveAfterSeason) {
      pendingSaveAfterSeason = false;
      saveDay();
    }
    return;
  }
  if (brMode === 'season') {
    // edit the season (name/start) together with its rotation
    if (!brDraft) return;
    const clash = seasonStartConflict(brDraft.start, brSeasonId);
    if (clash) {
      brSetHint(startConflictText(brDraft.start, clash));
      return;
    }
    const seasons = loadSeasons();
    const before = JSON.parse(JSON.stringify(seasons));
    const idx = seasons.findIndex((x) => x.id === brSeasonId);
    if (idx === -1) return;
    seasons[idx] = {
      ...seasons[idx],
      name: brDraft.name,
      start: brDraft.start,
      number: brDraft.number,
    };
    seasons.sort((a, b) => a.start.localeCompare(b.start));
    saveSeasons(seasons);
    const custom = loadCustomRotations();
    custom[brSeasonId] = {
      anchor: brAnchorEl.value,
      order: [...brOrder],
    };
    saveCustomRotations(custom);
    reapplyBossesForMovedDays(before, seasons);
    brApplyToLoggedDays(
      seasons,
      seasons.find((x) => x.id === brSeasonId),
    );
    closeSeasonModal(false);
    brRefreshAfterSave();
    return;
  }
  // rotation only: an existing season's rotation (asked for when saving)
  const seasons = loadSeasons();
  const season = seasons.find((x) => x.id === brSeasonId);
  if (!season) return;
  // Always stored as the player's own rotation once they press Save.
  // That marks the season as "rotation set" so daily saves are allowed.
  const custom = loadCustomRotations();
  custom[season.id] = { anchor: brAnchorEl.value, order: [...brOrder] };
  saveCustomRotations(custom);
  brApplyToLoggedDays(seasons, season);
  closeSeasonModal(false);
  brRefreshAfterSave();
  if (pendingSaveAfterRotation) {
    pendingSaveAfterRotation = false;
    saveDay();
  }
};

const deleteSeasonModal = document.getElementById('deleteSeasonModal');
const deleteSeasonMsg = document.getElementById('deleteSeasonMsg');
const deleteSeasonDaysCheckbox =
  document.getElementById('deleteSeasonDays');

const openDeleteSeasonModal = (sid) => {
  const seasons = loadSeasons();
  const s = seasons.find((x) => x.id === sid);
  if (!s) return;
  pendingDeleteSeasonId = sid;
  deleteSeasonMsg.textContent = `This removes “${seasonLabel(s)}” from the list. Your daily rank history can be kept or removed below.`;
  deleteSeasonDaysCheckbox.checked = false;
  deleteSeasonModal.hidden = false;
};

document.getElementById('modalDeleteCancel').onclick = () => {
  deleteSeasonModal.hidden = true;
  pendingDeleteSeasonId = null;
};
document.getElementById('modalDeleteConfirm').onclick = () => {
  if (!pendingDeleteSeasonId) return;
  let seasons = loadSeasons();
  const sid = pendingDeleteSeasonId;
  const seasonToRemove = seasons.find((x) => x.id === sid);
  const alsoDays = deleteSeasonDaysCheckbox.checked;

  if (alsoDays && seasonToRemove) {
    const range = getSeasonDateRange(seasons, seasonToRemove);
    const days = loadDays();
    let changed = false;
    Object.keys(days).forEach((date) => {
      if (dayInSeason(date, range)) {
        delete days[date];
        changed = true;
      }
    });
    if (changed) saveDays(days);
  }

  seasons = seasons.filter((x) => x.id !== sid);
  saveSeasons(seasons);
  deleteSeasonModal.hidden = true;
  pendingDeleteSeasonId = null;

  if (seasons.length) {
    activeSeasonId = seasons[seasons.length - 1].id;
    setActiveSeasonId(activeSeasonId);
  } else {
    activeSeasonId = null;
    try {
      localStorage.removeItem(ACTIVE_SEASON_KEY);
    } catch (e) {}
  }

  renderSeason();
  renderHistory();
  renderOverall();
  bossManualOverride = false;
  syncBossFromDate();
};

/* ===== Backup & transfer (export / import) ===== */
(() => {
  const BACKUP_APP = 'afk-journey-reward-tracker';
  const BACKUP_VERSION = 1;
  const MSG_KEY = 'afk_rank_tracker_import_msg';
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
  const el = (id) => document.getElementById(id);
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const statusEl = el('backupStatus');
  const say = (msg, kind) => {
    statusEl.textContent = msg;
    statusEl.className = 'backup-status' + (kind ? ' is-' + kind : '');
  };

  const readJSON = (key, fallback) => {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  };
  // Everything the tracker keeps in this browser
  const readAll = () => {
    const days = readJSON(STORAGE_KEY, {});
    const seasons = readJSON(SEASONS_KEY, []);
    const rot = readJSON(BOSS_ROTATIONS_KEY, {});
    let active = null;
    try {
      active = localStorage.getItem(ACTIVE_SEASON_KEY);
    } catch (e) {}
    return {
      days: isObj(days) ? days : {},
      seasons: (Array.isArray(seasons) ? seasons : []).filter(
        (s) => isObj(s) && typeof s.id === 'string',
      ),
      bossRotations: isObj(rot) ? rot : {},
      activeSeason: active,
    };
  };

  /* ---------- Export ---------- */
  const buildBackup = () => ({
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: readAll(),
  });
  const backupName = () => `afk-journey-tracker-backup-${todayStr()}.json`;
  const counts = (d) =>
    `${plural(Object.keys(d.days).length, 'day')} and ${plural(d.seasons.length, 'season')}`;

  const downloadBackup = (b) => {
    const blob = new Blob([JSON.stringify(b, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  el('exportBtn').onclick = () => {
    const b = buildBackup();
    if (!Object.keys(b.data.days).length && !b.data.seasons.length) {
      say('Nothing to export yet - log a day or add a season first.', 'err');
      return;
    }
    downloadBackup(b);
    say(`Exported ${counts(b.data)}. Look for the file in your Downloads.`, 'ok');
  };

  // "Share…" is only shown where the browser can share files (most phones)
  const canShareFiles = () => {
    try {
      return (
        !!navigator.share &&
        !!navigator.canShare &&
        navigator.canShare({
          files: [new File(['{}'], 'test.json', { type: 'application/json' })],
        })
      );
    } catch (e) {
      return false;
    }
  };
  const isTouch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  if (isTouch && canShareFiles()) el('shareBtn').hidden = false;
  el('shareBtn').onclick = async () => {
    const b = buildBackup();
    if (!Object.keys(b.data.days).length && !b.data.seasons.length) {
      say('Nothing to export yet - log a day or add a season first.', 'err');
      return;
    }
    const file = new File([JSON.stringify(b, null, 2)], backupName(), {
      type: 'application/json',
    });
    try {
      await navigator.share({ files: [file], title: 'AFK Journey tracker backup' });
      say('Backup shared.', 'ok');
    } catch (e) {
      if (e && e.name === 'AbortError') return; // closed the share menu
      downloadBackup(b);
      say(
        `Sharing is not available in this browser${e && e.name ? ' (' + e.name + ')' : ''}, ` +
          'so the backup was downloaded instead. Look in your Downloads.',
        'ok',
      );
    }
  };

  /* ---------- Import ---------- */
  // Check a parsed file and keep only well-formed data
  const cleanBackup = (obj) => {
    if (!isObj(obj) || obj.app !== BACKUP_APP || !isObj(obj.data))
      throw new Error('That file is not an AFK Journey tracker backup.');
    if (typeof obj.version === 'number' && obj.version > BACKUP_VERSION)
      throw new Error('That backup was made by a newer version of the tracker.');
    const d = obj.data;
    const days = {};
    if (isObj(d.days))
      Object.keys(d.days).forEach((k) => {
        const v = d.days[k];
        if (DATE_RE.test(k) && isObj(v) && (v.ranks === undefined || isObj(v.ranks)))
          days[k] = v;
      });
    const seasons = [];
    const seen = new Set();
    if (Array.isArray(d.seasons))
      d.seasons.forEach((s) => {
        if (
          isObj(s) &&
          typeof s.id === 'string' && s.id && !UNSAFE.has(s.id) && !seen.has(s.id) &&
          typeof s.name === 'string' &&
          typeof s.start === 'string' && DATE_RE.test(s.start)
        ) {
          seen.add(s.id);
          seasons.push(s);
        }
      });
    const bossRotations = {};
    if (isObj(d.bossRotations))
      Object.keys(d.bossRotations).forEach((k) => {
        const r = d.bossRotations[k];
        if (
          !UNSAFE.has(k) && isObj(r) &&
          typeof r.anchor === 'string' &&
          Array.isArray(r.order) && r.order.every((x) => typeof x === 'string')
        )
          bossRotations[k] = r;
      });
    if (!Object.keys(days).length && !seasons.length)
      throw new Error('That backup is empty.');
    return {
      exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : null,
      data: {
        days,
        seasons,
        bossRotations,
        activeSeason: typeof d.activeSeason === 'string' ? d.activeSeason : null,
      },
    };
  };

  const byStart = (a, b) => String(a.start).localeCompare(String(b.start));
  const pickActive = (seasons, ...prefs) => {
    for (const id of prefs)
      if (id && seasons.some((s) => s.id === id)) return id;
    return seasons.length ? seasons[seasons.length - 1].id : null;
  };
  // Keep this device's data and add the backup; the backup wins on a clash
  const mergeData = (cur, inc) => {
    const byId = new Map(cur.seasons.map((s) => [s.id, s]));
    inc.seasons.forEach((s) => byId.set(s.id, s));
    const seasons = [...byId.values()].sort(byStart);
    return {
      days: { ...cur.days, ...inc.days },
      seasons,
      bossRotations: { ...cur.bossRotations, ...inc.bossRotations },
      activeSeason: pickActive(seasons, cur.activeSeason, inc.activeSeason),
    };
  };
  const replaceData = (inc) => {
    const seasons = [...inc.seasons].sort(byStart);
    return {
      days: inc.days,
      seasons,
      bossRotations: inc.bossRotations,
      activeSeason: pickActive(seasons, inc.activeSeason),
    };
  };
  // Write everything, or put the old data back if the browser refuses
  const KEYS = [STORAGE_KEY, SEASONS_KEY, ACTIVE_SEASON_KEY, BOSS_ROTATIONS_KEY];
  const applyData = (res) => {
    const prev = KEYS.map((k) => {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res.days));
      localStorage.setItem(SEASONS_KEY, JSON.stringify(res.seasons));
      localStorage.setItem(BOSS_ROTATIONS_KEY, JSON.stringify(res.bossRotations));
      if (res.activeSeason) localStorage.setItem(ACTIVE_SEASON_KEY, res.activeSeason);
      else localStorage.removeItem(ACTIVE_SEASON_KEY);
    } catch (e) {
      KEYS.forEach((k, i) => {
        try {
          if (prev[i] === null) localStorage.removeItem(k);
          else localStorage.setItem(k, prev[i]);
        } catch (_) {}
      });
      throw new Error('Could not save to this browser (storage may be full or blocked).');
    }
  };

  const modal = el('importModal');
  let pending = null;
  const closeModal = () => {
    modal.hidden = true;
    pending = null;
  };
  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch (e) {
      return '';
    }
  };
  const openModal = (parsed) => {
    pending = parsed;
    el('importSummary').textContent =
      `Backup${parsed.exportedAt ? ' from ' + fmtDate(parsed.exportedAt) : ''}: ` +
      `${counts(parsed.data)}. On this device now: ${counts(readAll())}.`;
    modal.querySelector('input[value="merge"]').checked = true;
    modal.hidden = false;
  };

  el('importBtn').onclick = () => el('importFile').click();
  el('importFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      say('That file is too big to be a backup.', 'err');
      return;
    }
    try {
      openModal(cleanBackup(JSON.parse(await f.text())));
      say('');
    } catch (err) {
      say(
        err instanceof SyntaxError ? 'Could not read that file - is it a backup file?' : err.message,
        'err',
      );
    }
  };
  el('importCancel').onclick = closeModal;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
  el('importConfirm').onclick = () => {
    if (!pending) return;
    const replace = modal.querySelector('input[name="importMode"]:checked').value === 'replace';
    const res = replace ? replaceData(pending.data) : mergeData(readAll(), pending.data);
    try {
      applyData(res);
    } catch (err) {
      closeModal();
      say(err.message, 'err');
      return;
    }
    try {
      sessionStorage.setItem(
        MSG_KEY,
        `${replace ? 'Replaced this device’s data with the backup' : 'Merged the backup into this device'}. ` +
          `You now have ${counts(res)}.`,
      );
    } catch (e) {}
    location.reload(); // simplest way to make every tab show the new data
  };

  // After the reload: open Log history and show the result
  try {
    const m = sessionStorage.getItem(MSG_KEY);
    if (m) {
      sessionStorage.removeItem(MSG_KEY);
      const tab = document.querySelector('.tab[data-view="history"]');
      if (tab) tab.click();
      say(m, 'ok');
    }
  } catch (e) {}
})();
