/* ============================================================
   story.js — page data for "A Feijoa on Monday"

   All positions are in pixels of the original 3508 × 2480 art
   sheets (A4 landscape at 300 dpi) and converted to percentages
   with px(). Sprite rectangles come straight from the cut-out
   pipeline in tools/, so they land exactly where they were drawn.
   ============================================================ */

const SCENE_W = 3508;
const SCENE_H = 2480;

function px(x, y, w, h) {
  return {
    left:  (x / SCENE_W * 100) + '%',
    top:   (y / SCENE_H * 100) + '%',
    width: (w / SCENE_W * 100) + '%',
    height:(h / SCENE_H * 100) + '%'
  };
}

// fit a sprite of natural size (w × h) inside a box centred at (cx, cy)
function fit(cx, cy, boxW, boxH, w, h) {
  const s = Math.min(boxW / w, boxH / h);
  return px(cx - w * s / 2, cy - h * s / 2, w * s, h * s);
}

const IMG = 'assets/img/';

function fruitPage(n, name, bg, opts) {
  return {
    id: name,
    bg: IMG + bg,
    atmosphere: opts.atmosphere || null,
    text: opts.text,
    camera: opts.camera || { scale: 1.04, origin: '50% 60%' },
    after: [],
    objects: [
      {
        id: 'fruit',
        img: IMG + name + '-full.png',
        rect: opts.fruitRect,
        tap: { type: 'bite', mask: IMG + name + '-hole.png', cells: opts.cells,
               say: opts.say, crumbColor: opts.crumb, sparkColor: '#fff3b0' }
      },
      {
        id: 'number',
        img: IMG + 'num-' + n + '.png',
        rect: opts.numRect,
        tap: { type: 'say', text: opts.numWord, sparkColor: '#d2e26a' }
      },
      {
        id: 'word',
        img: IMG + 'word-' + name + '.png',
        rect: opts.wordRect,
        tap: { type: 'say', text: opts.say, sparkColor: '#d2e26a' }
      }
    ],
    hotspots: [
      // the caterpillar painted into the scene — a little "yum" when tapped
      { rect: px(40, 900, 1500, 760), sound: 'yum', sparkColor: '#ffe98a' }
    ]
  };
}

const FOODS = [
  ['lamington',      'lamington',        591, 427, '#8a5a2b'],
  ['hokey-pokey',    'hokey pokey',      349, 531, '#d8b27a'],
  ['pineapple-lump', 'pineapple lump',   649, 247, '#5a3a1a'],
  ['cheese',         'cheese',           452, 486, '#e2a01f'],
  ['pepperoni',      'pepperoni',        534, 427, '#d98a8a'],
  ['gummy-bear',     'gummy bear',       343, 511, '#e0443a'],
  ['mince-pie',      'mince pie',        554, 371, '#b78a4a'],
  ['sausage',        'sausage',          447, 231, '#b8461e'],
  ['muffin',         'blueberry muffin', 449, 406, '#4a3a9a'],
  ['rockmelon',      'rock melon',       465, 413, '#e08a2a']
];

function saturdayFoods() {
  const xs = [370, 1064, 1754, 2444, 3138];
  return FOODS.map(([id, say, w, h, crumb], i) => {
    const row = i < 5 ? 0 : 1;
    const cx = xs[i % 5];
    const cy = row === 0 ? 540 : 1740;
    return {
      id: 'food-' + id,
      img: IMG + 'food-' + id + '-full.png',
      rect: fit(cx, cy, 600, row === 0 ? 480 : 500, w, h),
      tap: { type: 'bite', mask: IMG + 'food-' + id + '-hole.png', say, crumbColor: crumb, sparkColor: '#fff3b0' }
    };
  });
}

const STORY = {

  title: 'A Feijoa on Monday',

  pages: [

    /* ---------------- 1 · The egg (night) ---------------- */
    {
      id: 'egg-night',
      bg: IMG + 'bg-p1.jpg',
      atmosphere: { type: 'night' },
      text: 'In the light of the moon, a little egg lay on a leaf.',
      camera: { scale: 1.22, origin: '38% 52%' },
      objects: [
        {
          id: 'egg',
          img: IMG + 'egg-night.png',
          rect: px(1175, 1103, 237, 342),
          tap: { type: 'shake', sound: 'bounce', sparkColor: '#cfe8ff' }
        }
      ],
      hotspots: [
        { rect: px(1680, 236, 508, 481), sound: 'shimmer', sparkColor: '#fff3b0' }   // the moon
      ]
    },

    /* ---------------- 2 · Pop! (sunrise) ---------------- */
    {
      id: 'hatching',
      bg: IMG + 'bg-p2.jpg',
      crossfade: true,
      atmosphere: { type: 'day', sun: [51, 23.3], clouds: false },
      text: 'One Sunday morning the warm sun came up and — pop! — out of the egg came a tiny and very hungry caterpillar.',
      afterText: 'He started to look for some food.',
      camera: { scale: 1.45, origin: '52% 58%' },
      cameraAfter: { scale: 1.05, origin: '55% 55%' },
      objects: [
        {
          id: 'egg',
          img: IMG + 'egg-day.png',
          rect: px(1618, 1149, 430, 571),
          tap: { type: 'hatch', cracked: 'cracked', hatched: 'hatched' }
        },
        { id: 'cracked', img: IMG + 'egg-cracked.png', rect: px(1611, 1142, 443, 583), hidden: true },
        { id: 'hatched', img: IMG + 'hatched.png',     rect: px(1615, 1299, 1028, 435), hidden: true }
      ],
      hotspots: [
        { rect: px(0, 560, 980, 770),    sound: 'chirp',   sparkColor: '#ffd1c1' },   // fantail
        { rect: px(1382, 140, 824, 894), sound: 'shimmer', sparkColor: '#fff3b0' }    // sun
      ]
    },

    /* ---------------- 3 · Monday · one feijoa ---------------- */
    fruitPage(1, 'feijoa', 'bg-p3.jpg', {
      atmosphere: { type: 'day', sun: [45.8, 18.7], clouds: false },
      text: 'On Monday he ate through one feijoa. But he was still hungry.',
      fruitRect: px(2310, 648, 383, 655),
      cells: null,
      say: 'feijoa', numWord: 'one', crumb: '#2d7a1f',
      numRect: px(405, 245, 412, 742),
      wordRect: px(2561, 161, 822, 292)
    }),

    /* ---------------- 4 · Tuesday · two tamarillos ---------------- */
    fruitPage(2, 'tamarillo', 'bg-p4.jpg', {
      text: 'On Tuesday he ate through two tamarillos, but he was still hungry.',
      fruitRect: px(2241, 487, 721, 764),
      cells: [[23.6, 72.5], [77.5, 72.5]],
      say: 'tamarillo', numWord: 'two', crumb: '#5a2510',
      numRect: px(339, 333, 431, 728),
      wordRect: px(2061, 139, 1274, 231)
    }),

    /* ---------------- 5 · Wednesday · three kiwifruit ---------------- */
    fruitPage(3, 'kiwi', 'bg-p5.jpg', {
      text: 'On Wednesday he ate through three kiwifruit, but he was still hungry.',
      fruitRect: px(1920, 757, 1367, 552),
      cells: [[17.8, 51.1], [49.7, 52.3], [83.3, 48.8]],
      say: 'kiwifruit', numWord: 'three', crumb: '#7a6a2a',
      numRect: px(263, 91, 459, 747),
      wordRect: px(2353, 155, 595, 230)
    }),

    /* ---------------- 6 · Thursday · four nectarines ---------------- */
    fruitPage(4, 'nectarine', 'bg-p6.jpg', {
      text: 'On Thursday he ate through four nectarines, but he was still hungry.',
      fruitRect: px(1636, 754, 1854, 528),
      cells: [[15.2, 58.1], [40.3, 55.7], [64.2, 59.5], [89.0, 55.8]],
      say: 'nectarine', numWord: 'four', crumb: '#c25a1a',
      numRect: px(321, 145, 440, 732),
      wordRect: px(1958, 165, 1269, 232)
    }),

    /* ---------------- 7 · Friday · five boysenberries ---------------- */
    fruitPage(5, 'boysenberry', 'bg-p7.jpg', {
      text: 'On Friday he ate through five boysenberries, but he was still hungry.',
      fruitRect: px(1774, 483, 1606, 809),
      cells: [[10.0, 36.9], [26.4, 82.7], [46.4, 36.8], [68.5, 83.3], [90.6, 38.5]],
      say: 'boysenberry', numWord: 'five', crumb: '#5a1a4a',
      numRect: px(299, 48, 419, 733),
      wordRect: px(1779, 154, 1600, 275)
    }),

    /* ---------------- 8 · Saturday · the big feast ---------------- */
    {
      id: 'saturday',
      bg: IMG + 'bg-p8.jpg',
      atmosphere: { type: 'sky' },
      text: 'On Saturday he ate through one piece of lamington, one hokey pokey cone, one pineapple lump, one slice of cheddar cheese, one slice of pepperoni, one gummy bear, one piece of mince pie, one cocktail sausage, one blueberry muffin, and one slice of rock melon.',
      afterText: 'That night he had a stomachache!',
      camera: { scale: 1, origin: '50% 50%' },
      after: [{ target: 'cat', anim: 'queasy', sound: 'gurgle' }],
      objects: [
        {
          id: 'cat',
          img: IMG + 'cat-p8.png',
          rect: px(1162, 889, 1008, 494),
          breathe: true,
          tap: { type: 'wiggle', sound: 'boing', sparkColor: '#ffe98a' }
        },
        ...saturdayFoods()
      ]
    },

    /* ---------------- 9 · Sunday · the swan plant leaf ---------------- */
    {
      id: 'leaf',
      bg: IMG + 'bg-p9.jpg',
      atmosphere: { type: 'sky' },
      text: 'The next day was Sunday again. The caterpillar ate through one nice swan plant leaf, and after that he felt much better.',
      camera: { scale: 1.04, origin: '50% 62%' },
      after: [{ target: 'cat', anim: 'happy', sound: 'yum', sparkle: '#ffe98a' }],
      objects: [
        {
          id: 'leaf',
          img: IMG + 'leaf-full.png',
          rect: px(0, 1089, 3390, 986),
          z: 1,
          tap: { type: 'bite', mask: IMG + 'leaf-hole.png', crumbColor: '#3f7a2a', sparkColor: '#d6ffb0' }
        },
        {
          id: 'cat',
          img: IMG + 'cat-p9.png',
          rect: px(1508, 1124, 950, 656),
          z: 2,
          breathe: true,
          tap: { type: 'wiggle', sound: 'boing', sparkColor: '#ffe98a' }
        }
      ]
    },

    /* ---------------- 10 · A big, fat caterpillar ---------------- */
    {
      id: 'big',
      bg: IMG + 'bg-p10.jpg',
      atmosphere: { type: 'sky' },
      text: 'Now he wasn’t hungry anymore — and he wasn’t a little caterpillar anymore. He was a big, fat caterpillar!',
      camera: { scale: 1, origin: '50% 50%' },
      objects: [
        {
          id: 'cat',
          img: IMG + 'cat-p10.png',
          rect: px(910, 363, 1920, 1514),
          origin: '50% 70%',
          breathe: true,
          tap: { type: 'grow' }
        }
      ]
    },

    /* ---------------- 11 · The cocoon ---------------- */
    {
      id: 'cocoon',
      bg: IMG + 'bg-p11.jpg',
      atmosphere: { type: 'sky' },
      text: 'He built a small house, called a cocoon, around himself. He stayed inside for more than two weeks.',
      camera: { scale: 1.08, origin: '65% 45%' },
      objects: [
        {
          id: 'cocoon',
          img: IMG + 'cocoon-p11.png',
          rect: px(2038, 700, 492, 763),
          origin: '50% 0%',
          tap: { type: 'sway' }
        }
      ],
      hotspots: [
        { rect: px(0, 0, 580, 1050), sound: 'shimmer', sparkColor: '#ffe98a' }   // kōwhai flowers
      ]
    },

    /* ---------------- 12 · A beautiful monarch butterfly ---------------- */
    {
      id: 'butterfly',
      bg: IMG + 'bg-p12.jpg',
      atmosphere: { type: 'sky' },
      text: 'Then he nibbled a hole in the cocoon, pushed his way out, and… he was a beautiful monarch butterfly!',
      camera: { scale: 1, origin: '50% 50%' },
      objects: [
        {
          id: 'cocoon',
          img: IMG + 'cocoon-p12.png',
          rect: px(100, 1100, 468, 854),
          origin: '50% 0%',
          tap: { type: 'emerge', butterfly: 'butterfly' }
        },
        { id: 'butterfly', img: IMG + 'butterfly.png', rect: px(1140, 772, 1374, 878), hidden: true, z: 3 }
      ]
    }
  ]
};
