/* ============================================================
   story.js — page data for "A Feijoa on Monday" (v2)

   Hand-written narrative and interaction. Every position comes
   from the generated js/layout.js (measured off the designer's
   3508 × 2480 sheets), referenced here by id — nothing is guessed.
   ============================================================ */

const SCENE_W = LAYOUT.sheet.w;
const SCENE_H = LAYOUT.sheet.h;
const IMG = 'assets/img/';
const AUD = 'assets/audio/';

function px(x, y, w, h) {
  return {
    left:  (x / SCENE_W * 100) + '%',
    top:   (y / SCENE_H * 100) + '%',
    width: (w / SCENE_W * 100) + '%',
    height:(h / SCENE_H * 100) + '%'
  };
}
function rectOf(id) {
  const r = LAYOUT.img[id];
  if (!r || r.x === undefined) throw new Error('layout has no rectangle for ' + id);
  return px(r.x, r.y, r.w, r.h);
}
// fit a sprite of natural size inside a box centred at (cx, cy) — only for the Saturday
// treats, which come on a contact sheet rather than in their page positions
function fitOf(id, cx, cy, boxW, boxH) {
  const r = LAYOUT.img[id];
  const s = Math.min(boxW / r.w, boxH / r.h);
  return px(cx - r.w * s / 2, cy - r.h * s / 2, r.w * s, r.h * s);
}
// the standalone bundle (tools/bundle.ps1) defines window.BUNDLE_ASSETS, mapping each path to a data: URI
const asset = (path) => (window.BUNDLE_ASSETS && window.BUNDLE_ASSETS[path]) || path;
const src = (id) => asset(IMG + LAYOUT.img[id].file);
const audio = (id) => asset(AUD + LAYOUT.audio[id]);

/* ---------- page builders ---------- */

function fruitPage(n, name, pageId, opts) {
  return {
    id: pageId,
    bg: 'bg-' + pageId,
    caption: [pageId],
    narration: pageId + '-narration',
    objects: [
      {
        id: 'fruit', layout: 'fruit-' + name,
        tap: { type: 'bite', mask: 'fruit-' + name + '-hole', cells: LAYOUT.holes['fruit-' + name],
               say: pageId + '-word', crumbColor: opts.crumb, sparkColor: '#fff3b0' }
      },
      { id: 'number', layout: 'num-' + n,      tap: { type: 'say', say: pageId + '-number', sparkColor: '#d2e26a' } },
      { id: 'word',   layout: 'word-' + name,  tap: { type: 'say', say: pageId + '-word',   sparkColor: '#d2e26a' } }
    ],
    hotspots: [
      // the caterpillar painted into the scene — a little "yum" when tapped
      { rect: px(40, 900, 1500, 760), sound: 'yum', sparkColor: '#ffe98a' }
    ]
  };
}

const FOODS = [
  ['lamington',      '#8a5a2b'],
  ['hokey-pokey',    '#d8b27a'],
  ['pineapple-lump', '#5a3a1a'],
  ['cheese',         '#e2a01f'],
  ['pepperoni',      '#d98a8a'],
  ['gummy-bear',     '#e0443a'],
  ['mince-pie',      '#b78a4a'],
  ['sausage',        '#b8461e'],
  ['muffin',         '#4a3a9a'],
  ['rockmelon',      '#e08a2a']
];

// The treats sit in two rows: above the caption panel and below the caterpillar,
// clear of both arrows. The caption (y 482–1061) and the caterpillar (y 895–1377)
// occupy the middle of the page.
function saturdayFoods() {
  const xs = [370, 1064, 1754, 2444, 3138];
  return FOODS.map(([id, crumb], i) => {
    const row = i < 5 ? 0 : 1;
    const cx = xs[i % 5];
    const cy = row === 0 ? 250 : 1720;
    return {
      id: 'food-' + id, layout: 'food-' + id,
      rect: fitOf('food-' + id, cx, cy, 600, row === 0 ? 390 : 540),
      tap: { type: 'bite', mask: 'food-' + id + '-hole', cells: LAYOUT.holes['food-' + id],
             say: 'p08-food-' + id, crumbColor: crumb, sparkColor: '#fff3b0' }
    };
  });
}

const STORY = {

  title: 'A Feijoa on Monday',

  cover: {
    bg: 'bg-cover',
    narration: 'cover-narration',
    arrow: 'cover-arrow',        // the designer's Start arrow, placed where drawn
    hand: 'cover-point'          // where the designer put the pointing hand
  },

  pages: [

    /* ---------------- 1 · The egg (night) ---------------- */
    {
      id: 'p01', bg: 'bg-p01', caption: ['p01'], narration: 'p01-narration',
      objects: [
        { id: 'egg', layout: 'egg-p01', tap: { type: 'shake', sound: 'bounce', sparkColor: '#cfe8ff' } }
      ],
      hotspots: [
        { rect: px(1680, 236, 508, 481), sound: 'shimmer', sparkColor: '#fff3b0' }   // the moon
      ]
    },

    /* ---------------- 2 · Pop! ---------------- */
    {
      id: 'p02', bg: 'bg-p02', caption: ['p02'], narration: 'p02-narration',
      objects: [
        { id: 'egg',     layout: 'egg-p02', tap: { type: 'hatch', cracked: 'cracked', hatched: 'hatched' } },
        { id: 'cracked', layout: 'egg-cracked-p02', hidden: true },
        { id: 'hatched', layout: 'hatched-p02',     hidden: true }
      ],
      hotspots: [
        { rect: px(0, 560, 980, 770),    sound: 'chirp',   sparkColor: '#ffd1c1' },   // fantail
        { rect: px(1382, 140, 824, 894), sound: 'shimmer', sparkColor: '#fff3b0' }    // sun
      ]
    },

    /* ---------------- 3–7 · one fruit a day ---------------- */
    fruitPage(1, 'feijoa',      'p03', { crumb: '#2d7a1f' }),
    fruitPage(2, 'tamarillo',   'p04', { crumb: '#5a2510' }),
    fruitPage(3, 'kiwi',        'p05', { crumb: '#7a6a2a' }),
    fruitPage(4, 'nectarine',   'p06', { crumb: '#c25a1a' }),
    fruitPage(5, 'boysenberry', 'p07', { crumb: '#5a1a4a' }),

    /* ---------------- 8 · Saturday · the big feast ---------------- */
    {
      id: 'p08', bg: 'bg-p08', caption: ['p08a', 'p08b'], narration: 'p08-narration',
      // when the recording reaches "That night he had a stomachache!" (word 43) the caterpillar turns queasy
      events: [{ word: 43, target: 'cat', anim: 'queasy', sound: 'gurgle' }],
      objects: [
        { id: 'cat', layout: 'cat-p08', breathe: true, tap: { type: 'wiggle', sound: 'boing', sparkColor: '#ffe98a' } },
        ...saturdayFoods()
      ]
    },

    /* ---------------- 9 · Sunday · the swan plant leaf ---------------- */
    {
      id: 'p09', bg: 'bg-p09', caption: ['p09'], narration: 'p09-narration',
      after: [{ target: 'cat', anim: 'happy', sound: 'yum', sparkle: '#ffe98a' }],
      objects: [
        // the whole leaf is painted into the background; tapping it fades in the designer's bitten leaf
        { id: 'leaf', layout: 'leaf-bitten-p09', z: 1, reveal: true,
          tap: { type: 'reveal', sound: 'munch', crumbColor: '#3f7a2a', sparkColor: '#d6ffb0' } },
        { id: 'cat',  layout: 'cat-p09', z: 2, breathe: true, tap: { type: 'wiggle', sound: 'boing', sparkColor: '#ffe98a' } }
      ]
    },

    /* ---------------- 10 · A big, fat caterpillar ---------------- */
    {
      id: 'p10', bg: 'bg-p10', caption: ['p10'], narration: 'p10-narration',
      objects: [
        { id: 'cat', layout: 'cat-p10', origin: '50% 70%', breathe: true, tap: { type: 'grow' } }
      ]
    },

    /* ---------------- 11 · The cocoon ---------------- */
    {
      id: 'p11', bg: 'bg-p11', caption: ['p11'], narration: 'p11-narration',
      objects: [
        { id: 'branch', layout: 'branch-p11', z: 1 },
        { id: 'cocoon', layout: 'cocoon-p11', z: 2, origin: '50% 0%', tap: { type: 'sway' } }
      ],
      hotspots: [
        { rect: px(0, 0, 580, 1050), sound: 'shimmer', sparkColor: '#ffe98a' }   // kōwhai flowers
      ]
    },

    /* ---------------- 12 · A beautiful monarch butterfly ---------------- */
    LAYOUT.flags.p12Layered ? {
      id: 'p12', bg: 'bg-p12', caption: ['p12'], narration: 'p12-narration',
      objects: [
        { id: 'branch',    layout: 'branch-p12', z: 1 },
        { id: 'cocoon',    layout: 'cocoon-p12', z: 2, origin: '50% 0%', tap: { type: 'emerge', butterfly: 'butterfly' } },
        { id: 'butterfly', layout: 'butterfly-p12', hidden: true, z: 3 }
      ]
    } : {
      // fallback if the page 12 sheet was not a flat sky: the cocoon stays painted in the background
      id: 'p12', bg: 'bg-p12', caption: ['p12'], narration: 'p12-narration',
      objects: [
        { id: 'cocoon',    rect: px(137, 1155, 374, 799), tap: { type: 'emerge', butterfly: 'butterfly', keep: true } },
        { id: 'butterfly', layout: 'butterfly-p12', hidden: true, z: 3 }
      ]
    }
  ]
};
