/*
 * Draws the DeskPet source icon — a white paw on a warm rounded square — to
 * resources/icon.png. Regenerate the full Tauri icon set afterwards with:
 *   npx tauri icon resources/icon.png
 */
const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const SIZE = 256
const R = 56 // corner radius

function makeCanvas() {
  return new Uint8ClampedArray(SIZE * SIZE * 4)
}
function setPixel(d, x, y, [r, g, b, a = 255]) {
  x = Math.round(x)
  y = Math.round(y)
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  const sa = a / 255
  const da = d[i + 3] / 255
  const oa = sa + da * (1 - sa)
  if (oa === 0) return
  d[i] = (r * sa + d[i] * da * (1 - sa)) / oa
  d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa
  d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa
  d[i + 3] = oa * 255
}
function fillCircle(d, cx, cy, rad, color) {
  for (let y = cy - rad; y <= cy + rad; y++)
    for (let x = cx - rad; x <= cx + rad; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= rad * rad) setPixel(d, x, y, color)
    }
}
function fillEllipse(d, cx, cy, rx, ry, color) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      if (dx * dx + dy * dy <= 1) setPixel(d, x, y, color)
    }
}
function inRounded(x, y) {
  if (x >= R && x <= SIZE - 1 - R) return true
  if (y >= R && y <= SIZE - 1 - R) return true
  const cx = x < R ? R : SIZE - 1 - R
  const cy = y < R ? R : SIZE - 1 - R
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= R * R
}

function draw() {
  const d = makeCanvas()
  const top = [242, 173, 86]
  const bot = [221, 130, 42]
  for (let y = 0; y < SIZE; y++) {
    const t = y / (SIZE - 1)
    const col = [
      Math.round(top[0] + (bot[0] - top[0]) * t),
      Math.round(top[1] + (bot[1] - top[1]) * t),
      Math.round(top[2] + (bot[2] - top[2]) * t),
      255
    ]
    for (let x = 0; x < SIZE; x++) if (inRounded(x, y)) setPixel(d, x, y, col)
  }
  const shadow = [120, 60, 10, 60]
  const white = [255, 255, 255, 255]
  fillEllipse(d, 151, 163, 46, 40, shadow)
  fillEllipse(d, 148, 158, 46, 40, white)
  const toes = [
    [88, 108, 25],
    [124, 80, 27],
    [172, 80, 27],
    [208, 108, 25]
  ]
  for (const [tx, ty, tr] of toes) {
    fillCircle(d, tx + 2, ty + 4, tr, shadow)
    fillCircle(d, tx, ty, tr, white)
  }
  return d
}

const png = new PNG({ width: SIZE, height: SIZE })
png.data = Buffer.from(draw().buffer)
fs.mkdirSync(path.join(__dirname, '..', 'resources'), { recursive: true })
fs.writeFileSync(path.join(__dirname, '..', 'resources', 'icon.png'), PNG.sync.write(png))
console.log('Wrote resources/icon.png — now run: npx tauri icon resources/icon.png')
