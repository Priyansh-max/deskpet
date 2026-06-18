/*
 * Generates placeholder pet sprite frames and a tray icon.
 *
 * These are simple programmatically-drawn animals so the app works end-to-end
 * (animation, CPU-driven speed, pet switching). Replace the PNGs in
 * src/renderer/assets/<pet>/ with real art for a polished look — the loader just
 * needs files named <pet>_1.png ... <pet>_N.png.
 */
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const SIZE = 64
const FRAMES = 8

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'renderer', 'assets')
const RESOURCES_DIR = path.join(__dirname, '..', 'resources')

const OUTLINE = [40, 30, 20, 255]
const EYE = [25, 25, 30, 255]
const WHITE = [245, 245, 245, 255]

// --- tiny drawing toolkit (RGBA canvas, source-over blending) ---

function makeCanvas() {
  return { size: SIZE, data: new Uint8ClampedArray(SIZE * SIZE * 4) }
}

function setPixel(c, x, y, [r, g, b, a = 255]) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return
  const i = (y * c.size + x) * 4
  const sa = a / 255
  const da = c.data[i + 3] / 255
  const outA = sa + da * (1 - sa)
  if (outA === 0) return
  c.data[i] = (r * sa + c.data[i] * da * (1 - sa)) / outA
  c.data[i + 1] = (g * sa + c.data[i + 1] * da * (1 - sa)) / outA
  c.data[i + 2] = (b * sa + c.data[i + 2] * da * (1 - sa)) / outA
  c.data[i + 3] = outA * 255
}

function fillRect(c, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPixel(c, x, y, color)
}

function fillCircle(c, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) setPixel(c, x, y, color)
    }
}

function fillEllipse(c, cx, cy, rx, ry, color) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) setPixel(c, x, y, color)
    }
}

function fillTriangle(c, p0, p1, p2, color) {
  const minX = Math.floor(Math.min(p0[0], p1[0], p2[0]))
  const maxX = Math.ceil(Math.max(p0[0], p1[0], p2[0]))
  const minY = Math.floor(Math.min(p0[1], p1[1], p2[1]))
  const maxY = Math.ceil(Math.max(p0[1], p1[1], p2[1]))
  const area = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const p = [x, y]
      const d0 = area(p0, p1, p)
      const d1 = area(p1, p2, p)
      const d2 = area(p2, p0, p)
      const neg = d0 < 0 || d1 < 0 || d2 < 0
      const pos = d0 > 0 || d1 > 0 || d2 > 0
      if (!(neg && pos)) setPixel(c, x, y, color)
    }
}

// --- per-species drawers; each returns a fresh canvas for one frame ---

function drawQuad(style, frame) {
  const c = makeCanvas()
  const angle = (frame / FRAMES) * Math.PI * 2
  const s = style.scale || 1
  const bob = Math.round(Math.sin(angle * 2) * 1.5)
  const bodyY = 34 + bob
  const rx = Math.round(17 * s)
  const ry = Math.round(9 * s)
  const legLen = style.legLen || 13

  // Legs: two pairs swinging in opposite phase.
  const legX = [22, 29, 40, 47]
  const legPhase = [0, Math.PI, Math.PI, 0]
  for (let i = 0; i < legX.length; i++) {
    const swing = Math.round(Math.sin(angle + legPhase[i]) * 3)
    const top = bodyY + ry - 2
    const footY = top + legLen + swing
    fillRect(c, legX[i] - 1, top, 4, Math.max(2, footY - top), style.dark)
    fillRect(c, legX[i] - 2, footY, 6, 3, OUTLINE)
  }

  fillEllipse(c, 33, bodyY, rx, ry, style.body)

  const tailSway = Math.round(Math.sin(angle) * 3)
  if (style.tail === 'long') {
    fillRect(c, 13, bodyY - 4, 3, 16 + tailSway, style.dark)
  } else if (style.tail === 'curl') {
    fillEllipse(c, 16, bodyY - 7 + tailSway, 4, 7, style.body)
  } else {
    fillEllipse(c, 15, bodyY - 2 + tailSway, 3, 6, style.body)
  }

  const headX = 50
  const headY = bodyY - 8
  fillCircle(c, headX, headY, Math.round(8 * Math.min(s, 1.1)), style.body)

  if (style.ear === 'pointy') {
    fillTriangle(c, [headX - 6, headY - 5], [headX - 2, headY - 13], [headX + 1, headY - 6], style.body)
    fillTriangle(c, [headX + 2, headY - 6], [headX + 5, headY - 13], [headX + 8, headY - 5], style.body)
  } else {
    fillEllipse(c, headX - 6, headY - 1, 3, 7, style.dark)
    fillEllipse(c, headX + 7, headY - 1, 3, 7, style.dark)
  }

  if (style.mane) {
    for (let i = 0; i < 6; i++) fillRect(c, headX - 6 - i * 3, headY - 10 + i, 4, 10, style.dark)
  }

  fillCircle(c, headX + 5, headY + 2, 3, style.dark)
  fillCircle(c, headX + 2, headY - 2, 1, EYE)
  return c
}

function drawBird(style, frame) {
  const c = makeCanvas()
  const angle = (frame / FRAMES) * Math.PI * 2
  const bob = Math.round(Math.sin(angle * 2) * 1.5)
  const cy = 34 + bob

  fillEllipse(c, 30, cy, 11, 9, style.body)
  // Tail feathers (left).
  fillTriangle(c, [20, cy - 2], [9, cy - 6], [12, cy + 4], style.dark)

  // Head + beak (upper right).
  const hx = 42
  const hy = cy - 7
  fillCircle(c, hx, hy, 7, style.body)
  fillTriangle(c, [hx + 5, hy - 1], [hx + 13, hy + 1], [hx + 5, hy + 4], style.beak)
  fillCircle(c, hx + 2, hy - 2, 1, EYE)

  // Legs.
  for (const lx of [28, 34]) {
    fillRect(c, lx, cy + 7, 2, 6, style.beak)
    fillRect(c, lx - 1, cy + 13, 4, 2, OUTLINE)
  }

  // Flapping wing: apex rises/falls with the cycle.
  const flap = Math.round(Math.sin(angle) * 8)
  fillTriangle(c, [24, cy - 2], [36, cy - 2], [30, cy - 9 + flap], style.dark)
  return c
}

function drawFish(style, frame) {
  const c = makeCanvas()
  const angle = (frame / FRAMES) * Math.PI * 2
  const bob = Math.round(Math.sin(angle * 2))
  const cy = 34 + bob
  const sway = Math.round(Math.sin(angle) * 4)

  fillEllipse(c, 32, cy, 16, 9, style.body)
  // Swishing tail fin (left).
  fillTriangle(c, [18, cy], [7, cy - 8 + sway], [7, cy + 8 + sway], style.dark)
  // Dorsal + belly fins.
  fillTriangle(c, [28, cy - 8], [36, cy - 8], [32, cy - 15], style.dark)
  fillTriangle(c, [28, cy + 8], [36, cy + 8], [32, cy + 14], style.dark)
  // Gill + eye (right).
  fillRect(c, 38, cy - 4, 1, 8, style.dark)
  fillCircle(c, 42, cy - 2, 2, WHITE)
  fillCircle(c, 43, cy - 2, 1, EYE)
  return c
}

const DRAWERS = { quad: drawQuad, bird: drawBird, fish: drawFish }

const PETS = {
  cat: { kind: 'quad', body: [232, 162, 61], dark: [170, 110, 30], ear: 'pointy', tail: 'curl' },
  dog: { kind: 'quad', body: [155, 107, 67], dark: [105, 70, 40], ear: 'floppy', tail: 'straight' },
  horse: {
    kind: 'quad',
    body: [150, 95, 55],
    dark: [95, 60, 35],
    ear: 'pointy',
    tail: 'long',
    mane: true,
    scale: 1.15,
    legLen: 17
  },
  bird: { kind: 'bird', body: [79, 150, 224], dark: [40, 95, 160], beak: [240, 180, 60, 255] },
  fish: { kind: 'fish', body: [46, 196, 182], dark: [26, 140, 130] }
}

function drawTray() {
  const c = makeCanvas()
  const accent = [232, 162, 61, 255]
  fillEllipse(c, 16, 21, 7, 6, accent)
  fillCircle(c, 9, 12, 3, accent)
  fillCircle(c, 15, 9, 3, accent)
  fillCircle(c, 21, 9, 3, accent)
  fillCircle(c, 27, 13, 3, accent)
  return c
}

function writePng(canvas, outPath) {
  const png = new PNG({ width: canvas.size, height: canvas.size })
  png.data = Buffer.from(canvas.data.buffer)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, PNG.sync.write(png))
}

function main() {
  for (const [name, style] of Object.entries(PETS)) {
    const draw = DRAWERS[style.kind]
    for (let f = 0; f < FRAMES; f++) {
      writePng(draw(style, f), path.join(ASSETS_DIR, name, `${name}_${f + 1}.png`))
    }
    console.log(`Generated ${FRAMES} frames for ${name}`)
  }
  writePng(drawTray(), path.join(RESOURCES_DIR, 'tray.png'))
  console.log('Generated tray icon')
}

main()
