/* ============================================================
   story.js — page data for "A Feijoa on Monday"

   All positions are percentages of the 1316 × 924 scene.
   Narration text here is our own retelling written for this
   book — edit freely; the engine just reads these strings.
   ============================================================ */

const SCENE_W = 1316;
const SCENE_H = 924;

// helper: convert scene pixels → percentage strings
function px(x, y, w, h) {
  return {
    left:  (x / SCENE_W * 100) + '%',
    top:   (y / SCENE_H * 100) + '%',
    width: (w / SCENE_W * 100) + '%',
    height:(h / SCENE_H * 100) + '%'
  };
}

const STORY = {

  title: 'A Feijoa on Monday',
  subtitle: 'a tap-along story from a windy Wellington garden',

  pages: [

    /* ------------------------------------------------------
       PAGE 1 — The Egg (night)
       ------------------------------------------------------ */
    {
      id: 'egg-night',
      scene: 'night',
      text: 'Under the smiling moon, a little white egg lay fast asleep on a leaf.',
      camera: { scale: 1.18, origin: '46% 36%' },
      arrow: { when: 'narration' },   // enabled once narration finishes
      objects: [
        {
          id: 'egg',
          img: 'assets/img/egg-night.png',
          rect: px(434, 406, 96, 136),
          breathe: false,
          tap: { effect: 'wobble', sound: 'wobble', sparkColor: '#cfe8ff' }
        }
      ],
      hotspots: [
        {
          id: 'moon',
          rect: px(632, 94, 182, 176),
          tap: { effect: 'glow', sound: 'shimmer', sparkColor: '#fff3b0' }
        }
      ]
    },

    /* ------------------------------------------------------
       PAGE 2 — The Hatching (night fades to day)
       ------------------------------------------------------ */
    {
      id: 'hatching',
      scene: 'day',
      crossfadeFrom: 'night',   // cross-fade on page open
      text: 'One Sunday morning the warm sun rose over the hills\u2026 POP! Out of the egg wriggled a tiny caterpillar \u2014 and my, was he hungry.',
      afterText: 'Off he went to find something yummy to eat.',
      camera: { scale: 1.55, origin: '52% 55%' },
      cameraAfter: { scale: 1.1, origin: '55% 52%' },
      arrow: { when: 'event', event: 'hatched' },
      objects: [
        {
          id: 'egg2',
          img: 'assets/img/egg.png',
          rect: px(598, 423, 169, 222),
          tap: { effect: 'hatch', tapsNeeded: 3 }   // handled by the hatch sequence
        },
        {
          id: 'caterpillar',
          img: 'assets/img/caterpillar.png',
          rect: px(794, 395, 378, 253),
          hiddenAtStart: true,
          breathe: true
        }
      ],
      hotspots: []
    }

  ]
};
