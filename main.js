import Matter from 'matter-js';
import { WebHaptics } from 'web-haptics';

const { Engine, Runner, Bodies, Body, World, Mouse, MouseConstraint } = Matter;

const haptics = new WebHaptics();
// Pre-initialise the hidden iOS checkbox so it exists before the first gesture.
// The library creates it lazily inside trigger(), but calling trigger() from
// within a pointerdown handler is synchronous up to the first await, so the
// checkbox gets created and clicked in the same user-gesture stack frame —
// which is what iOS requires to fire the Taptic Engine.


const ANAGRAMS = [
  'PANIC EASELS',
  'NASAL PIECES',
  'NAILS ESCAPE',
  'CASES ALPINE',
  'PECAN AISLES',
];

let generation = 0;
let currentText = 'ALIEN SPACES';
let gravityToggle = null;
let scrambleAction = null;

document.getElementById('scramble').addEventListener('click', function () {
  if (scrambleAction) {
    const pick = ANAGRAMS[Math.floor(Math.random() * ANAGRAMS.length)];
    scrambleAction(pick);
  }
});

document.getElementById('reset').addEventListener('click', function () {
  if (scrambleAction) {
    scrambleAction('ALIEN SPACES');
  } else {
    reinit('ALIEN SPACES');
  }
});

document.getElementById('gravity').addEventListener('click', function () {
  if (gravityToggle) gravityToggle();
});

// Prevent Matter.js touch listeners on document.body from swallowing taps on controls
document.getElementById('controls').addEventListener('touchstart', e => e.stopPropagation(), { passive: false });
document.getElementById('controls').addEventListener('touchend',   e => e.stopPropagation(), { passive: false });

// Buzz on button tap; stop propagation so the body's 'medium' doesn't also fire
document.getElementById('controls').addEventListener('pointerdown', e => {
  e.stopPropagation();
  haptics.trigger('buzz');
}, { passive: true });

document.fonts.load("900 1em 'TikTok Sans'").then(() => reinit('ALIEN SPACES'));

function reinit(text) {
  currentText = text;
  generation++;
  gravityToggle = null;
  scrambleAction = null;
  document.body.classList.remove('gravity-off');
  document.querySelectorAll('.letter, .object, .coming-soon').forEach(el => el.remove());
  const dbg = document.querySelector('canvas');
  if (dbg) dbg.remove();
  init(text);
}

function init(text) {
  const myGen = generation;

  document.title = text.charAt(0) + text.slice(1).toUpperCase();

  const W = window.innerWidth;
  const H = window.innerHeight;

  // Responsive font size — scale to viewport, capped for legibility
  let FONT_SIZE = Math.max(88, Math.min(W * 0.118, 176));

  // Measure total text width using canvas and scale down if needed
  const offscreen = document.createElement('canvas');
  const mctx = offscreen.getContext('2d');

  function setFont(size) {
    mctx.font = `${size}px 'TikTok Sans', 'sans-serif`;
  }

  const SPACE_RATIO = 0.38;
  const GAP_RATIO  = -0.0; // tight tracking (slightly negative gap)
  const CAP_RATIO  = 0.84;   // cap height as fraction of font size

  function measureChars(size, str) {
    setFont(size);
    let total = 0;
    const data = [];
    for (const ch of str) {
      if (ch === ' ') {
        const sw = size * SPACE_RATIO;
        data.push({ ch, w: sw });
        total += sw;
      } else {
        const m = mctx.measureText(ch);
        const w     = m.width; // advance width — used for layout/positioning
        const wBody = m.actualBoundingBoxLeft + m.actualBoundingBoxRight; // ink width — used for collision body
        data.push({ ch, w, wBody });
        total += w + size * GAP_RATIO;
      }
    }
    total -= size * GAP_RATIO; // remove trailing gap
    return { data, total };
  }

  const WORDS = text.split(' ');

  // Use two lines if the full string doesn't fit at the chosen size.
  // If two lines, scale down until the wider word fits.
  const twoLines = measureChars(FONT_SIZE, text).total > W * 0.92;

  if (twoLines) {
    while (true) {
      const maxW = Math.max(...WORDS.map(w => measureChars(FONT_SIZE, w).total));
      if (maxW <= W * 0.92 || FONT_SIZE <= 88) break;
      FONT_SIZE -= 4;
    }
  }

  const LETTER_H = FONT_SIZE * CAP_RATIO;
  const GAP      = FONT_SIZE * GAP_RATIO;
  const PAD      = FONT_SIZE * 0.02; // collision buffer on all edges

  // --- Physics engine ---
  const engine = Engine.create();
  engine.gravity.y = 1.4;

  // Thick invisible walls on all four edges
  const T = 200;
  World.add(engine.world, [
    Bodies.rectangle(W / 2, H + T / 2 - 10, W + T * 2, T, { isStatic: true, label: 'floor'   }),
    Bodies.rectangle(W / 2,    -T / 2,   W + T * 2, T, { isStatic: true, label: 'ceiling' }),
    Bodies.rectangle(   -T / 2, H / 2, T, H + T * 2, { isStatic: true, label: 'left'    }),
    Bodies.rectangle(W + T / 2, H / 2, T, H + T * 2, { isStatic: true, label: 'right'   }),
  ]);

  // --- Create letter elements + physics bodies ---
  const letters = [];
  const ROW_GAP = LETTER_H * 0.18; // vertical gap between lines in portrait

  function spawnRow(str, startY) {
    const { data, total } = measureChars(FONT_SIZE, str);
    let x = (W - total) / 2;
    for (const { ch, w, wBody } of data) {
      if (ch === ' ') { x += w; continue; }

      const cx = x + w / 2;
      const cy = startY + LETTER_H / 2;

      // DOM element
      const el = document.createElement('div');
      el.className = 'letter';
      el.textContent = ch;
      el.style.fontSize   = FONT_SIZE + 'px';
      el.style.width      = w + 'px';
      el.style.height     = LETTER_H + 'px';
      el.style.lineHeight = '1';
      document.body.appendChild(el);

      // Physics body — ink width per letter plus padding buffer on all edges
      const bodyH = (LETTER_H + PAD * 2) * 0.8;
      const body = Bodies.rectangle(cx, cy + bodyH * 0.125, wBody + PAD * 2, bodyH, {
        restitution: 0.38,
        friction:    0.06,
        frictionAir: 0.014,
        density:     0.003,
      });

      // Tiny random horizontal nudge so they don't fall in a perfectly flat pile
      Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.2, y: 0 });

      World.add(engine.world, body);
      letters.push({ el, body, w, h: LETTER_H });

      x += w + GAP;
    }
  }

  const totalTextH = twoLines ? 2 * LETTER_H + ROW_GAP : LETTER_H;
  const topY = (H - totalTextH) / 2;

  if (twoLines) {
    WORDS.forEach((word, i) => spawnRow(word, topY + i * (LETTER_H + ROW_GAP)));
  } else {
    spawnRow(text, topY);
  }

  // Mark the first letter of each word with a persistent class.
  // These classes travel with the DOM elements through scrambles.
  let wordStart = 0;
  for (const word of WORDS) {
    letters[wordStart].el.classList.add('letter--word-initial');
    wordStart += word.length;
  }

  // --- "Coming soon" label ---
  const LABEL_SIZE = Math.max(10, Math.round(FONT_SIZE * 0.15));
  const LABEL_TEXT  = 'Coming soon';
  const LABEL_PAD_X = LABEL_SIZE * 0.7;
  const LABEL_PAD_Y = LABEL_SIZE * 0.45;
  const LABEL_H = LABEL_SIZE + LABEL_PAD_Y * 2;
  const h1Bottom = twoLines ? topY + 2 * LETTER_H + ROW_GAP : topY + LETTER_H;

  const labelEl = document.createElement('div');
  labelEl.className   = 'coming-soon';
  labelEl.textContent = LABEL_TEXT;
  labelEl.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    "font-family:'TikTok Sans', sans-serif",
    'font-weight:700',
    `font-size:${LABEL_SIZE}px`,
    'color:#fff',
    'background:#66f',
    'display:inline-block',
    `padding:${LABEL_PAD_Y}px ${LABEL_PAD_X}px`,
    `height:${LABEL_H}px`,
    `line-height:${LABEL_SIZE}px`,
    `border-radius:${LABEL_SIZE}px`,
    'text-align:center',
    'user-select:none',
    'cursor:grab',
    'white-space:nowrap',
    'transform-origin:center center',
    "font-variation-settings:'slnt' 0, 'wdth' 150",
  ].join(';');
  document.body.appendChild(labelEl);
  const LABEL_W = labelEl.getBoundingClientRect().width;

  const labelBody = Bodies.rectangle(W / 2, h1Bottom + LABEL_H, LABEL_W, LABEL_H, {
    restitution: 0.38,
    friction:    0.06,
    frictionAir: 0.014,
    density:     0.003,
  });
  Body.setVelocity(labelBody, { x: (Math.random() - 0.5) * 1.2, y: 0 });
  World.add(engine.world, labelBody);
  const labelObj = { el: labelEl, body: labelBody, w: LABEL_W, h: LABEL_H };

  // --- Object images ---
  const asobjects = [];
  const OBJECT_MAX_W = Math.round(W * (W < 768 ? 0.306 : 0.153));
  const OBJECT_MAX_H = Math.round(H * (W < 768 ? 0.506 : 0.43));

  // Text exclusion zone (add padding)
  const textTotalW = twoLines
    ? Math.max(...WORDS.map(w => measureChars(FONT_SIZE, w).total))
    : measureChars(FONT_SIZE, text).total;
  const exLeft   = W / 2 - textTotalW / 2 - 30;
  const exRight  = W / 2 + textTotalW / 2 + 30;
  const exTop    = topY - 30;
  const exBottom = (twoLines ? topY + 2 * LETTER_H + ROW_GAP : topY + LETTER_H) + 30;

  let enlargedObject = null;

  function shrinkEnlarged() {
    if (!enlargedObject) return;
    const o = enlargedObject;
    o.el.style.width  = o.w + 'px';
    o.el.style.height = o.h + 'px';
    o.el.classList.remove('object--enlarged');
    Body.scale(o.body, 0.6667, 0.6667);
    enlargedObject = null;
  }

  const allObjects = ['object0.png', 'object1.png', 'object2.png', 'object3.png', 'object4.png', 'object5.png', 'object6.png', 'object7.png', 'object8.png', 'object9.png'];
  const shuffled = allObjects.sort(() => Math.random() - 0.5);
  shuffled.slice(0, 6).forEach(src => {
    const img = document.createElement('img');
    img.className = 'object';
    img.draggable = false;
    img.addEventListener('dragstart', e => e.preventDefault());
    img.style.cssText = 'position:absolute;top:0;left:0;user-select:none;transform-origin:center center;';
    document.body.appendChild(img);

    img.onload = function () {
      if (generation !== myGen) { img.remove(); return; }

      const scale = Math.min(OBJECT_MAX_W / img.naturalWidth, OBJECT_MAX_H / img.naturalHeight, 1);
      const cw = Math.round(img.naturalWidth  * scale);
      const ch = Math.round(img.naturalHeight * scale);
      img.style.width  = cw + 'px';
      img.style.height = ch + 'px';

      // Random position that doesn't overlap the text block
      let cx, cy, attempts = 0;
      do {
        cx = cw / 2 + Math.random() * (W - cw);
        cy = ch / 2 + Math.random() * (H - ch);
        attempts++;
      } while (
        attempts < 60 &&
        cx - cw / 2 < exRight && cx + cw / 2 > exLeft &&
        cy - ch / 2 < exBottom && cy + ch / 2 > exTop
      );

      const angle = (Math.random() - 0.5) * Math.PI * 0.6;
      const body = Bodies.rectangle(cx, cy, cw * 0.8, ch * 0.8, {
        restitution: 0.3,
        friction:    0.4,
        frictionAir: 0.015,
        density:     0.004,
        angle,
      });

      World.add(engine.world, body);
      const entry = { el: img, body, w: cw, h: ch };
      asobjects.push(entry);

      let pointerDownX, pointerDownY;
      img.addEventListener('pointerdown', function (e) {
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
      });
      img.addEventListener('pointerup', function (e) {
        const dx = e.clientX - pointerDownX;
        const dy = e.clientY - pointerDownY;
        if (Math.sqrt(dx * dx + dy * dy) > 6) return; // was a drag, ignore
        e.stopPropagation();
        if (enlargedObject === entry) {
          shrinkEnlarged();
        } else {
          shrinkEnlarged();
          entry.el.style.width  = (entry.w * 1.5) + 'px';
          entry.el.style.height = (entry.h * 1.5) + 'px';
          entry.el.classList.add('object--enlarged');
          Body.scale(entry.body, 2, 2);
          enlargedObject = entry;
        }
      });
    };

    img.src = src;
  });

  // --- Gravity toggle ---
  let gravityActive = true;
  gravityToggle = function () {
    gravityActive = !gravityActive;
    if (!gravityActive) {
      document.body.classList.add('gravity-off');
      engine.gravity.y = 0;
      for (const { body } of letters) {
        Body.set(body, { frictionAir: 0, friction: 0 });
        const dx = body.position.x - W / 2;
        const dy = body.position.y - H / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = 10 + Math.random() * 6;
        Body.setVelocity(body, { x: (dx / dist) * speed, y: (dy / dist) * speed });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
      }
      for (const { body } of asobjects) {
        Body.set(body, { frictionAir: 0, friction: 0 });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06);
      }
      Body.set(labelBody, { frictionAir: 0, friction: 0 });
      const ldx = labelBody.position.x - W / 2;
      const ldy = labelBody.position.y - H / 2;
      const ldist = Math.sqrt(ldx * ldx + ldy * ldy) || 1;
      const lspeed = 10 + Math.random() * 6;
      Body.setVelocity(labelBody, { x: (ldx / ldist) * lspeed, y: (ldy / ldist) * lspeed });
      Body.setAngularVelocity(labelBody, (Math.random() - 0.5) * 0.4);
    } else {
      document.body.classList.remove('gravity-off');
      engine.gravity.y = 1.4;
      for (const { body } of letters) {
        Body.set(body, { frictionAir: 0.014, friction: 0.06 });
      }
      for (const { body } of asobjects) {
        Body.set(body, { frictionAir: 0.015, friction: 0.4 });
      }
      Body.set(labelBody, { frictionAir: 0.014, friction: 0.06 });
    }
  };

  // --- Scramble in-place ---
  let swapping = false;
  let swapTargets = [];

  scrambleAction = function (newText) {
    if (swapping) return;

    // Compute target centre positions for the new arrangement
    const newWords = newText.split(' ');
    const newTwoLines = measureChars(FONT_SIZE, newText).total > W * 0.92;
    const targets = [];

    function computeRow(str, startY) {
      const { data, total } = measureChars(FONT_SIZE, str);
      let x = (W - total) / 2;
      let nextIsWordInitial = true;
      for (const { ch, w } of data) {
        if (ch === ' ') { x += w; nextIsWordInitial = true; continue; }
        targets.push({ ch, tx: x + w / 2, ty: startY + LETTER_H / 2, wordInitial: nextIsWordInitial });
        nextIsWordInitial = false;
        x += w + GAP;
      }
    }

    if (newTwoLines) {
      newWords.forEach((word, i) => computeRow(word, topY + i * (LETTER_H + ROW_GAP)));
    } else {
      computeRow(newText, topY);
    }

    // Match each target slot to the nearest unmatched letter with the same character.
    // Word-initial slots are matched first, preferring .letter--word-initial elements,
    // so those styled letters always land at the start of a word.
    const available = [...letters];
    swapTargets = [];

    function matchTarget({ ch, tx, ty }, preferWordInitial) {
      let bestIdx = -1, bestDist = Infinity;
      for (let i = 0; i < available.length; i++) {
        if (available[i].el.textContent !== ch) continue;
        if (preferWordInitial && !available[i].el.classList.contains('letter--word-initial')) continue;
        const dx = available[i].body.position.x - tx;
        const dy = available[i].body.position.y - ty;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      // Fall back to any matching character if no word-initial candidate found
      if (bestIdx === -1) {
        for (let i = 0; i < available.length; i++) {
          if (available[i].el.textContent !== ch) continue;
          const dx = available[i].body.position.x - tx;
          const dy = available[i].body.position.y - ty;
          const d = dx * dx + dy * dy;
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
      }
      const letter = available.splice(bestIdx, 1)[0];
      swapTargets.push({ letter, tx, ty });
    }

    // First pass: word-initial slots (matched to .letter--word-initial elements)
    targets.filter(t => t.wordInitial).forEach(t => matchTarget(t, true));
    // Second pass: remaining slots
    targets.filter(t => !t.wordInitial).forEach(t => matchTarget(t, false));

    // Re-enable gravity and reset colour scheme in case it was toggled off
    gravityActive = true;
    document.body.classList.remove('gravity-off');
    Body.set(labelBody, { frictionAir: 0.014, friction: 0.06 });

    // Suspend gravity and collisions for the duration of the swap
    engine.gravity.y = 0;
    for (const { body } of letters) {
      Body.set(body, { frictionAir: 0.014, friction: 0.06 });
      body.collisionFilter.mask = 0;
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
    }

    swapping = true;
    currentText = newText;
  };

  // --- Mouse drag ---
  const mouse = Mouse.create(document.body);
  const mc = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.16,
      damping:   0.1,
      render: { visible: false },
    },
  });
  World.add(engine.world, mc);

  // Haptics — triggered directly from pointer events to stay within the
  // browser's user-gesture requirement for the Vibration API.
  // pointerdown is a direct user gesture — iOS requires this for Taptic Engine
  document.body.addEventListener('pointerdown',   () => haptics.trigger('medium'), { passive: true });
  document.body.addEventListener('pointerup',     () => haptics.cancel(),          { passive: true });
  document.body.addEventListener('pointercancel', () => haptics.cancel(),          { passive: true });

  // Prevent Matter.js from swallowing scroll events
  mouse.element.removeEventListener('mousewheel',    mouse.mousewheel);
  mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);

  // Touch support
  mouse.element.removeEventListener('touchmove', mouse.mousemove);
  mouse.element.addEventListener('touchmove', function(e) {
    const t = e.touches[0];
    mouse.position.x = t.clientX;
    mouse.position.y = t.clientY;
  }, { passive: true });

  // --- Debug overlay ---
  const dbgCanvas = document.createElement('canvas');
  dbgCanvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;z-index:9999';
  dbgCanvas.width  = W;
  dbgCanvas.height = H;
  document.body.appendChild(dbgCanvas);
  const dbgCtx = dbgCanvas.getContext('2d');

  let debug = false;
  window.addEventListener('keydown', e => {
    if (e.key === 'd' || e.key === 'D') debug = !debug;
  });

  // --- Runner + render loop ---
  Runner.run(Runner.create(), engine);

  (function loop() {
    if (generation !== myGen) return;
    requestAnimationFrame(loop);

    if (swapping) {
      let allDone = true;
      for (const { letter, tx, ty } of swapTargets) {
        const { body, el, w, h } = letter;
        const dx = tx - body.position.x;
        const dy = ty - body.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          allDone = false;
          Body.setVelocity(body, { x: dx * 0.12, y: dy * 0.12 });
          Body.setAngularVelocity(body, body.angle * -0.1);
        } else {
          Body.setPosition(body, { x: tx, y: ty });
          Body.setAngle(body, 0);
          Body.setVelocity(body, { x: 0, y: 0 });
          Body.setAngularVelocity(body, 0);
        }
        const { x, y } = body.position;
        el.style.left      = (x - w / 2) + 'px';
        el.style.top       = (y - h / 2 - h * 0.1) + 'px';
        el.style.transform = `rotate(${body.angle}rad)`;
      }
      if (allDone) {
        swapping = false;
        engine.gravity.y = gravityActive ? 1.4 : 0;
        for (const { body } of letters) {
          body.collisionFilter.mask = 0xFFFFFFFF;
        }
      }
    } else {
      for (const { el, body, w, h } of letters) {
        const { x, y } = body.position;
        el.style.left      = (x - w / 2) + 'px';
        el.style.top       = (y - h / 2 - h * 0.1) + 'px';
        el.style.transform = `rotate(${body.angle}rad)`;
      }
    }

    {
      const { x, y } = labelObj.body.position;
      labelObj.el.style.left      = (x - labelObj.w / 2) + 'px';
      labelObj.el.style.top       = (y - labelObj.h / 2) + 'px';
      labelObj.el.style.transform = `rotate(${labelObj.body.angle}rad)`;
    }

    for (const { el, body, w, h } of asobjects) {
      const { x, y } = body.position;
      el.style.left      = (x - w / 2) + 'px';
      el.style.top       = (y - h / 2) + 'px';
      el.style.transform = `rotate(${body.angle}rad)`;
    }

    dbgCtx.clearRect(0, 0, W, H);
    if (debug) {
      dbgCtx.strokeStyle = 'yellow';
      dbgCtx.lineWidth   = 1;
      for (const { body } of letters) {
        const verts = body.vertices;
        dbgCtx.beginPath();
        dbgCtx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) dbgCtx.lineTo(verts[i].x, verts[i].y);
        dbgCtx.closePath();
        dbgCtx.stroke();
      }
    }
  })();
}
