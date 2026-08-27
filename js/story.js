/* ==========================================================================
   STORY DATA — the file you edit to change the book.

   Page fields
     bg      'night' | 'day'                 which version of your scene
     cam     { zoom, x, y }                  camera: zoom factor and the point (%) it zooms into
     text    caption + narration
     after   caption spoken once the page's task is done (optional)
     audio / afterAudio   MP3 names in assets/audio/ (used when recordings = true)
     items   objects on the page (see below)
     task    how many "required" taps unlock the arrow (0 = none)
     last    true on the final page (arrow restarts the book)

   Item fields
     id, kind:'img'|'svg', src (img) | shape (svg)
     x, y, w   centre position and width, as % of the DRAWING (not the screen)
     idle      'breathe' | 'sway' | 'flap' | 'hover'
     flip      true to mirror the image
     tap       { anim, sfx, say, react, lunge, bite, grow, count, required, then, onComplete, fly }
        react  big speech bubble text shown above the object named in `lunge` (or the item itself)
        lunge  id of another object that lunges toward this one (Pip taking a bite)
   ========================================================================== */

const SHAPES = {
  moon: `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" fill="#f9d448" stroke="#111" stroke-width="7"/></svg>`,

  cloud: `<svg viewBox="0 0 240 120"><path d="M40 100 C 10 100 10 60 40 58 C 42 30 80 20 96 44 C 110 18 160 22 166 54 C 200 48 222 80 200 100 Z" fill="#fff" stroke="#111" stroke-width="6" stroke-linejoin="round"/></svg>`,

  feijoa: `
    <svg viewBox="0 0 200 200">
      <defs><mask id="m__ID__"><rect width="200" height="200" fill="#fff"/><circle class="bite" cx="152" cy="78" r="30" fill="#000"/></mask></defs>
      <g mask="url(#m__ID__)">
        <ellipse cx="100" cy="112" rx="62" ry="80" fill="#7fb047" stroke="#111" stroke-width="7"/>
        <circle cx="72" cy="90" r="9" fill="#9dc75f"/><circle cx="118" cy="128" r="11" fill="#9dc75f"/><circle cx="84" cy="150" r="7" fill="#9dc75f"/>
        <path d="M84 36 l8 -18 l8 16 l8 -18 l8 18" fill="#5e8a2d" stroke="#111" stroke-width="6" stroke-linejoin="round"/>
      </g>
      <path class="bite" d="M136 52 a30 30 0 0 0 -3 52" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  tamarillo: `
    <svg viewBox="0 0 200 200">
      <defs><mask id="m__ID__"><rect width="200" height="200" fill="#fff"/><circle class="bite" cx="150" cy="90" r="30" fill="#000"/></mask></defs>
      <g mask="url(#m__ID__)">
        <path d="M100 30 C 150 30 162 90 160 125 C 158 165 130 190 100 190 C 70 190 42 165 40 125 C 38 90 50 30 100 30 Z" fill="#d9302b" stroke="#111" stroke-width="7"/>
        <ellipse cx="74" cy="82" rx="12" ry="22" fill="#f47a72" transform="rotate(-15 74 82)"/>
        <path d="M100 30 q4 -22 26 -24" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      </g>
      <path class="bite" d="M134 64 a30 30 0 0 0 -3 52" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  kiwifruit: `
    <svg viewBox="0 0 200 200">
      <defs><mask id="m__ID__"><rect width="200" height="200" fill="#fff"/><circle class="bite" cx="150" cy="85" r="30" fill="#000"/></mask></defs>
      <g mask="url(#m__ID__)">
        <ellipse cx="100" cy="110" rx="78" ry="60" fill="#8a6a3a" stroke="#111" stroke-width="7"/>
        <g stroke="#5c4424" stroke-width="4" stroke-linecap="round">
          <path d="M40 80 l-8 -8"/><path d="M60 60 l-6 -10"/><path d="M100 50 l0 -11"/><path d="M140 60 l6 -10"/><path d="M160 80 l8 -8"/>
          <path d="M40 140 l-8 8"/><path d="M60 160 l-6 10"/><path d="M100 170 l0 11"/><path d="M140 160 l6 10"/><path d="M160 140 l8 8"/>
        </g>
      </g>
      <g class="bite">
        <circle cx="150" cy="85" r="24" fill="#8fd14f"/><circle cx="150" cy="85" r="8" fill="#e9f5d0"/>
        <path d="M134 60 a30 30 0 0 0 -3 52" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      </g>
    </svg>`,

  hokeypokey: `
    <svg viewBox="0 0 200 200">
      <defs><mask id="m__ID__"><rect width="200" height="200" fill="#fff"/><circle class="bite" cx="148" cy="60" r="26" fill="#000"/></mask></defs>
      <path d="M62 96 L100 192 L138 96 Z" fill="#d9a45b" stroke="#111" stroke-width="7" stroke-linejoin="round"/>
      <g stroke="#a8763a" stroke-width="4"><path d="M70 116 l50 46"/><path d="M80 142 l32 30"/><path d="M130 116 l-50 46"/><path d="M120 142 l-32 30"/></g>
      <g mask="url(#m__ID__)">
        <circle cx="100" cy="72" r="52" fill="#f6dc8c" stroke="#111" stroke-width="7"/>
        <g fill="#d99a1e"><circle cx="78" cy="60" r="7"/><circle cx="108" cy="46" r="8"/><circle cx="122" cy="84" r="6"/><circle cx="88" cy="96" r="7"/><circle cx="100" cy="72" r="5"/></g>
      </g>
      <path class="bite" d="M135 38 a26 26 0 0 0 -4 44" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  leaf: `
    <svg viewBox="0 0 200 200">
      <defs><mask id="m__ID__"><rect width="200" height="200" fill="#fff"/><circle class="bite" cx="140" cy="70" r="28" fill="#000"/></mask></defs>
      <g mask="url(#m__ID__)">
        <path d="M100 10 C 160 40 175 120 100 190 C 25 120 40 40 100 10 Z" fill="#6dae3d" stroke="#111" stroke-width="7" stroke-linejoin="round"/>
        <path d="M100 20 L100 180" stroke="#3f7a20" stroke-width="6" stroke-linecap="round"/>
        <g stroke="#3f7a20" stroke-width="4" stroke-linecap="round"><path d="M100 60 l30 20"/><path d="M100 60 l-30 20"/><path d="M100 100 l34 22"/><path d="M100 100 l-34 22"/><path d="M100 140 l24 16"/><path d="M100 140 l-24 16"/></g>
      </g>
      <path class="bite" d="M124 44 a28 28 0 0 0 -2 50" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
    </svg>`,

  chrysalis: `
    <svg viewBox="0 0 200 260">
      <path d="M100 0 v34" stroke="#111" stroke-width="8" stroke-linecap="round"/>
      <path d="M100 34 C 146 34 156 110 150 170 C 144 225 122 250 100 250 C 78 250 56 225 50 170 C 44 110 54 34 100 34 Z" fill="#9fd6a3" stroke="#111" stroke-width="7"/>
      <path d="M60 78 C 80 92 120 92 140 78" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      <g fill="#e2b400" stroke="#111" stroke-width="3"><circle cx="66" cy="85" r="6"/><circle cx="84" cy="93" r="6"/><circle cx="100" cy="96" r="6"/><circle cx="116" cy="93" r="6"/><circle cx="134" cy="85" r="6"/></g>
      <ellipse cx="74" cy="150" rx="10" ry="30" fill="#c7ecc8" transform="rotate(8 74 150)"/>
    </svg>`,

  butterfly: `
    <svg viewBox="0 0 260 200">
      <g id="wl__ID__">
        <path d="M128 100 C 90 20 20 20 16 70 C 12 110 70 116 120 106 Z" fill="#111"/>
        <path d="M126 100 C 94 34 34 32 30 70 C 27 102 74 110 118 103 Z" fill="#f28c1e"/>
        <path d="M128 106 C 80 110 22 122 22 152 C 22 178 78 182 124 112 Z" fill="#111"/>
        <path d="M126 108 C 84 114 34 126 34 150 C 34 168 80 172 122 114 Z" fill="#f4a03a"/>
        <g stroke="#111" stroke-width="4" fill="none"><path d="M124 100 L 40 66"/><path d="M124 100 L 62 92"/><path d="M124 100 L 84 52"/><path d="M124 108 L 52 150"/><path d="M124 108 L 88 160"/></g>
        <g fill="#fff"><circle cx="24" cy="70" r="3"/><circle cx="34" cy="46" r="3"/><circle cx="56" cy="30" r="3"/><circle cx="24" cy="120" r="3"/><circle cx="30" cy="160" r="3"/><circle cx="66" cy="176" r="3"/></g>
      </g>
      <use href="#wl__ID__" transform="translate(260 0) scale(-1 1)"/>
      <ellipse cx="130" cy="106" rx="9" ry="40" fill="#111"/>
      <circle cx="130" cy="64" r="9" fill="#111"/>
      <path d="M126 58 q-14 -18 -20 -26 M134 58 q14 -18 20 -26" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/>
    </svg>`,
};

const PIP = 'assets/img/caterpillar.png';

// Pip on the leaf, ready to eat. Reused on the food pages.
const pipEating = (say) => ({ id: 'pip', kind: 'img', src: PIP, x: 40, y: 64, w: 27, idle: 'breathe',
  tap: { anim: 'wiggle', sfx: 'tap', say } });

const STORY = {
  title: "Pip's Big Garden Munch",
  recordings: false,   // set to true once you've put MP3s in assets/audio/

  pages: [
    // 1 — Night. Your scene, wide.
    {
      bg: 'night', cam: { zoom: 1.15, x: 42, y: 45 }, audio: 'page-01',
      text: "Down in a windy Wellington garden, a tiny egg sat on a leaf. The moon kept watch all night long.",
      items: [
        { id: 'moon', kind: 'svg', shape: 'moon', x: 50.4, y: 15.7, w: 19.9,
          tap: { anim: 'glow', sfx: 'hum', say: 'Goodnight, moon.', react: 'Goodnight!' } },
        { id: 'egg', kind: 'img', src: 'assets/img/egg.png', x: 35.6, y: 59.7, w: 11.7, idle: 'breathe',
          tap: { anim: 'wobble', sfx: 'wobble', say: "Shh... something's inside.", react: 'Shh...' } },
      ],
      task: 0,
    },

    // 2 — Morning. Camera pushes in on the egg. Tap three times to hatch.
    {
      bg: 'day', cam: { zoom: 1.7, x: 40, y: 58 }, audio: 'page-02',
      text: "Morning came. The egg wobbled and wiggled. Tap the egg and see who's inside!",
      after: "POP! Out came Pip, the smallest caterpillar in the whole garden.",
      afterAudio: 'page-02b',
      items: [
        { id: 'egg', kind: 'img', src: 'assets/img/egg.png', x: 35.6, y: 59.7, w: 11.7,
          tap: { anim: 'wobble', sfx: 'wobble', count: 3, required: true, onComplete: 'hatch', react: ['Wobble!', 'Wiggle!', 'POP!'] } },
      ],
      task: 1,
    },

    // 3 — Hungry.
    {
      bg: 'day', cam: { zoom: 1.5, x: 42, y: 60 }, audio: 'page-03',
      text: "Pip had a tiny tummy and a very BIG rumble. \"I'm hungry!\" said Pip. \"What is good to eat?\"",
      items: [
        { id: 'pip', kind: 'img', src: PIP, x: 40, y: 64, w: 27, idle: 'breathe',
          tap: { anim: 'wiggle', sfx: 'rumble', say: "I'm so hungry!", react: 'Rumble!' } },
      ],
      task: 0,
    },

    // 4–7 — Tasting. Tap the food: Pip lunges, a bite appears, a bubble pops up.
    {
      bg: 'day', cam: { zoom: 1.5, x: 48, y: 56 }, audio: 'page-04',
      text: "Pip found a feijoa, green and bumpy. Sniff... nibble... \"Ooh! Too sour!\"",
      items: [
        pipEating('Feijoa, please!'),
        { id: 'food', kind: 'svg', shape: 'feijoa', x: 60, y: 46, w: 13, idle: 'sway',
          tap: { anim: 'munch', sfx: 'munch', bite: true, required: true, lunge: 'pip', say: 'Feijoa! Too sour!', react: 'Too sour!', then: 'yuck' } },
      ],
      task: 1,
    },
    {
      bg: 'day', cam: { zoom: 1.5, x: 48, y: 56 }, audio: 'page-05',
      text: "Next, a tamarillo, red and shiny. Nibble... \"Hmm. Too tangy!\"",
      items: [
        pipEating('Tamarillo, please!'),
        { id: 'food', kind: 'svg', shape: 'tamarillo', x: 60, y: 46, w: 13, idle: 'sway',
          tap: { anim: 'munch', sfx: 'munch', bite: true, required: true, lunge: 'pip', say: 'Tamarillo! Too tangy!', react: 'Too tangy!', then: 'yuck' } },
      ],
      task: 1,
    },
    {
      bg: 'day', cam: { zoom: 1.5, x: 48, y: 56 }, audio: 'page-06',
      text: "Then a kiwifruit, brown and fuzzy. Nibble... \"Too tickly!\" Pip's nose went a-CHOO!",
      items: [
        pipEating('A-choo!'),
        { id: 'food', kind: 'svg', shape: 'kiwifruit', x: 61, y: 47, w: 14, idle: 'sway',
          tap: { anim: 'munch', sfx: 'munch', bite: true, required: true, lunge: 'pip', say: 'Kiwifruit! Too tickly! A-choo!', react: 'A-CHOO!', then: 'sneeze' } },
      ],
      task: 1,
    },
    {
      bg: 'day', cam: { zoom: 1.5, x: 48, y: 56 }, audio: 'page-07',
      text: "Under a bench, Pip found a hokey pokey ice cream. Lick... \"Brrr! Too cold!\"",
      items: [
        pipEating('Brrr!'),
        { id: 'food', kind: 'svg', shape: 'hokeypokey', x: 60, y: 44, w: 13, idle: 'sway',
          tap: { anim: 'munch', sfx: 'lick', bite: true, required: true, lunge: 'pip', say: 'Hokey pokey! Too cold!', react: 'Brrr! Too cold!', then: 'yuck' } },
      ],
      task: 1,
    },

    // 8 — Swan plant. Count the leaves.
    {
      bg: 'day', cam: { zoom: 1.45, x: 50, y: 54 }, audio: 'page-08',
      text: "Then Pip found a swan plant. Munch, munch, munch! \"Just right!\" Tap the leaves and count them.",
      after: "One, two, three! Monarch caterpillars only eat swan plant leaves.",
      afterAudio: 'page-08b',
      items: [
        { id: 'pip', kind: 'img', src: PIP, x: 38, y: 65, w: 27, idle: 'breathe', tap: { anim: 'munch', sfx: 'munch', say: 'Yum, yum, yum!', react: 'Yum!' } },
        { id: 'leaf1', kind: 'svg', shape: 'leaf', x: 56, y: 38, w: 11, idle: 'sway', tap: { anim: 'munch', sfx: 'munch', bite: true, required: true, lunge: 'pip', say: 'One!', react: '1', then: 'count' } },
        { id: 'leaf2', kind: 'svg', shape: 'leaf', x: 67, y: 48, w: 11, idle: 'sway', tap: { anim: 'munch', sfx: 'munch', bite: true, required: true, lunge: 'pip', say: 'Two!', react: '2', then: 'count' } },
        { id: 'leaf3', kind: 'svg', shape: 'leaf', x: 58, y: 58, w: 11, idle: 'sway', tap: { anim: 'munch', sfx: 'munch', bite: true, required: true, lunge: 'pip', say: 'Three! Just right!', react: '3', then: 'yum' } },
      ],
      task: 3,
    },

    // 9 — Growing.
    {
      bg: 'day', cam: { zoom: 1.4, x: 44, y: 58 }, audio: 'page-09',
      text: "Pip ate, and grew. And ate, and grew. Tap Pip to help Pip grow big and round!",
      after: "What a big, round caterpillar!",
      afterAudio: 'page-09b',
      items: [
        { id: 'pip', kind: 'img', src: PIP, x: 42, y: 62, w: 16, idle: 'breathe',
          tap: { anim: 'munch', sfx: 'munch', grow: 1.28, count: 3, required: true, say: 'Munch!', react: ['Munch!', 'Bigger!', 'Biggest!'] } },
      ],
      task: 1,
    },

    // 10 — Chrysalis, on the plant at the right of your drawing.
    {
      bg: 'day', cam: { zoom: 1.8, x: 84, y: 44 }, audio: 'page-10',
      text: "Pip hung upside down and made a jade-green chrysalis with tiny gold dots. Inside, Pip was changing...",
      items: [
        { id: 'chrys', kind: 'svg', shape: 'chrysalis', x: 87, y: 40, w: 10, idle: 'sway',
          tap: { anim: 'shiver', sfx: 'shimmer', say: 'Shh. Pip is changing.', react: 'Shh...' } },
      ],
      task: 0,
    },

    // 11 — Butterfly. Wide shot; tap to fly.
    {
      bg: 'day', cam: { zoom: 1, x: 50, y: 50 }, audio: 'page-11',
      text: "Out came... a monarch butterfly! Orange and black, with wings like stained glass. Off flew Pip, into the Wellington wind.",
      items: [
        { id: 'bfly', kind: 'svg', shape: 'butterfly', x: 44, y: 56, w: 24, idle: 'flap',
          tap: { anim: 'flutter', sfx: 'flutter', say: 'Goodbye, garden!', react: 'Goodbye!', fly: true } },
      ],
      task: 0,
      last: true,
    },
  ],
};
