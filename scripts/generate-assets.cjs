/*
 * Generates placeholder pet sprite frames and a tray icon.
 *
 * These are simple programmatically-drawn walking quadrupeds so the full
 * app works end-to-end (animation, CPU-driven speed, pet switching).
 * Replace the PNGs in src/renderer/assets/<pet>/ with real art for a
 * polished look — the loader just needs files named <pet>_1.png ... <pet>_8.png.
 */
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const SIZE = 64
const FRAMES = 8

const ASSETS_DIR = path.join(__dirname, '..', 'src', 'renderer', 'assets')
const RESOURCES_DIR = path.join(__dirname, '..', 'resources')

/** Create a transparent RGBA canvas. */
function makeCanvas(size) {
  return { size, data: new Uint8ClampedArray(size * size * 4) }
}

function setPixel(c, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= c.size || y >= c.size) return
  const i = (y * c.size + x) * 4
  // Simple source-over alpha blend onto whatever is there.
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
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(c, x, y, color)
  }
}

function fillCircle(c, cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= radius * radius) setPixel(c, x, y, color)
    }
  }
}

function fillEllipse(c, cx, cy, rx, ry, color) {
  for (let y = cy - ry; y <= cy + ry; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) setPixel(c, x, y, color)
    }
  }
}

function fillTriangle(c, p0, p1, p2, color) {
  const minX = Math.min(p0[0], p1[0], p2[0])
  const maxX = Math.max(p0[0], p1[0], p2[0])
  const minY = Math.min(p0[1], p1[1], p2[1])
  const maxY = Math.max(p0[1], p1[1], p2[1])
  const area = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x, y]
      const d0 = area(p0, p1, p)
      const d1 = area(p1, p2, p)
      const d2 = area(p2, p0, p)
      const hasNeg = d0 < 0 || d1 < 0 || d2 < 0
      const hasPos = d0 > 0 || d1 > 0 || d2 > 0
      if (!(hasNeg && hasPos)) setPixel(c, x, y, color)
    }
  }
}

const PET_STYLES = {
  cat: {
    body: [232, 162, 61],
    dark: [170, 110, 30],
    ear: 'pointy'
  },
  dog: {
    body: [155, 107, 67],
    dark: [105, 70, 40],
    ear: 'floppy'
  }
}

const OUTLINE = [40, 30, 20, 255]
const EYE = [25, 25, 30, 255]

/** Draw one walking frame (0..FRAMES-1) of a pet onto a fresh canvas. */
function drawPet(petName, frame) {
  const c = makeCanvas(SIZE)
  const style = PET_STYLES[petName]
  const angle = (frame / FRAMES) * Math.PI * 2

  // Gentle vertical bob so the pet feels alive.
  const bob = Math.round(Math.sin(angle * 2) * 1.5)
  const bodyY = 32 + bob

  // Legs: two pairs that swing in opposite phase to read as a walk cycle.
  const legX = [18, 26, 38, 46]
  const legPhase = [0, Math.PI, Math.PI, 0]
  for (let i = 0; i < legX.length; i++) {
    const swing = Math.round(Math.sin(angle + legPhase[i]) * 3)
    const top = bodyY + 6
    const footY = bodyY + 14 + swing
    fillRect(c, legX[i] - 1, top, 4, Math.max(2, footY - top), style.dark)
    // Foot.
    fillRect(c, legX[i] - 2, footY, 6, 3, OUTLINE)
  }

  // Body.
  fillEllipse(c, 32, bodyY, 18, 9, style.body)
  fillEllipse(c, 32, bodyY - 1, 18, 8, style.body)

  // Tail (left side), sways with the walk cycle.
  const tailSway = Math.round(Math.sin(angle) * 3)
  fillEllipse(c, 14, bodyY - 6 + tailSway, 4, 7, style.body)

  // Head (right side).
  const headX = 49
  const headY = bodyY - 8
  fillCircle(c, headX, headY, 9, style.body)

  // Ears.
  if (style.ear === 'pointy') {
    fillTriangle(c, [headX - 7, headY - 5], [headX - 2, headY - 14], [headX + 1, headY - 6], style.body)
    fillTriangle(c, [headX + 2, headY - 6], [headX + 6, headY - 14], [headX + 9, headY - 5], style.body)
  } else {
    fillEllipse(c, headX - 6, headY - 1, 3, 7, style.dark)
    fillEllipse(c, headX + 7, headY - 1, 3, 7, style.dark)
  }

  // Snout + eye.
  fillCircle(c, headX + 6, headY + 2, 3, style.dark)
  fillCircle(c, headX + 3, headY - 2, 1, EYE)
  setPixel(c, headX + 8, headY + 1, OUTLINE)

  return c
}

/** A small paw-print tray icon, accent colored to read on light or dark trays. */
function drawTray() {
  const size = 32
  const c = makeCanvas(size)
  const accent = [232, 162, 61, 255]
  // Main pad.
  fillEllipse(c, 16, 21, 7, 6, accent)
  // Toes.
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
  for (const pet of Object.keys(PET_STYLES)) {
    for (let f = 0; f < FRAMES; f++) {
      const canvas = drawPet(pet, f)
      writePng(canvas, path.join(ASSETS_DIR, pet, `${pet}_${f + 1}.png`))
    }
    console.log(`Generated ${FRAMES} frames for ${pet}`)
  }
  writePng(drawTray(), path.join(RESOURCES_DIR, 'tray.png'))
  console.log('Generated tray icon')
}

main()
