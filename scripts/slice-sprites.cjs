/*
 * Slices real sprite sheets (in each src/renderer/assets/<pet>/) into individual
 * transparent frames named <pet>_1.png ... <pet>_N.png.
 *
 *  - Decodes JPG/PNG via Electron's nativeImage.
 *  - Removes a solid background on JPEGs by flood-filling from the cell edges
 *    (so interior same-colored regions are kept).
 *  - Crops all frames of a pet to a shared bounding box (keeps alignment).
 *  - Moves the source sheet to ./sprite-sheets/ so it isn't bundled.
 *
 * Run:  npx electron scripts/slice-sprites.cjs
 */
const { app, nativeImage } = require('electron')
const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const ASSETS = path.join(__dirname, '..', 'src', 'renderer', 'assets')
const SHEET_OUT = path.join(__dirname, '..', 'sprite-sheets')

const SHEETS = {
  // White background, irregular grid (5 on top, 3 on bottom). Empty cells are
  // skipped. keepLights so the cat's white paws/chest aren't removed with the bg.
  cat: { file: 'cat.png', cols: 5, rows: 2, tol: 55, seed: [255, 255, 255], keepLights: true },
  // Green background, 4x2; use only the top row (the cream/white dog). Faces
  // left, so flip to face right.
  dog: { file: 'dog.jpg', cols: 4, rows: 2, rowsUsed: 1, tol: 85, flipX: true },
  bird: { file: 'bird.jpg', cols: 3, rows: 3, tol: 70, fringeTol: 135, passes: 6 },
  horse: { file: 'horse.jpg', cols: 4, rows: 4, tol: 85, fringeTol: 155, passes: 6 },
  // Cartoon blue fish, 4x3 on black. Black bg == black outline, so keepEdge
  // preserves the outline (and keeps the fins attached). Faces left -> flip.
  fish: { file: 'fish.png', cols: 4, rows: 3, tol: 60, seed: [0, 0, 0], keepEdge: true, keepLights: true, flipX: true }
}

/** Decode an image file to {width,height,data(RGBA)}. */
function decode(file) {
  const img = nativeImage.createFromPath(file)
  const { width, height } = img.getSize()
  const bgra = img.toBitmap() // BGRA on Windows
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bgra[i * 4 + 2]
    data[i * 4 + 1] = bgra[i * 4 + 1]
    data[i * 4 + 2] = bgra[i * 4]
    data[i * 4 + 3] = bgra[i * 4 + 3]
  }
  return { width, height, data }
}

/** Mirror a cell horizontally in place (to flip a left-facing sprite to right). */
function flipCellX(arr, cw, ch) {
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw >> 1; x++) {
      const a = (y * cw + x) * 4
      const b = (y * cw + (cw - 1 - x)) * 4
      for (let k = 0; k < 4; k++) {
        const t = arr[a + k]
        arr[a + k] = arr[b + k]
        arr[b + k] = t
      }
    }
  }
}

/** Extract a cell rectangle into its own RGBA array. */
function extract(img, cx, cy, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch * 4)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((cy + y) * img.width + (cx + x)) * 4
      const di = (y * cw + x) * 4
      out[di] = img.data[si]
      out[di + 1] = img.data[si + 1]
      out[di + 2] = img.data[si + 2]
      out[di + 3] = img.data[si + 3]
    }
  }
  return out
}

/**
 * Flood-fill the background to transparent, starting from the cell edges.
 * A pixel counts as background if it's already (near-)transparent OR within
 * `tol` of the seed colour (the corner pixel, or an explicit `seed` such as
 * white). This handles solid backgrounds, baked-in checker/white backgrounds,
 * and stray white halos alike, while keeping interior same-coloured regions.
 */
function keyOutBackground(arr, cw, ch, tol, seed, keepEdge) {
  const s = seed || [arr[0], arr[1], arr[2]]
  const visited = new Uint8Array(cw * ch)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= cw || y >= ch || visited[y * cw + x]) return
    visited[y * cw + x] = 1
    stack.push(x, y)
  }
  // A "subject" pixel is opaque and far from the background colour.
  const isSubject = (x, y) => {
    if (x < 0 || y < 0 || x >= cw || y >= ch) return false
    const j = (y * cw + x) * 4
    return arr[j + 3] >= 24 && colorDist(arr, j, s) > tol
  }
  for (let x = 0; x < cw; x++) {
    push(x, 0)
    push(x, ch - 1)
  }
  for (let y = 0; y < ch; y++) {
    push(0, y)
    push(cw - 1, y)
  }
  while (stack.length) {
    const y = stack.pop()
    const x = stack.pop()
    const i = (y * cw + x) * 4
    const transparent = arr[i + 3] < 24
    if (!transparent && colorDist(arr, i, s) > tol) continue
    // keepEdge: when the bg colour equals the subject's outline colour (e.g.
    // black bg + black outline), keep bg pixels that touch the subject so the
    // outline survives instead of being eaten away.
    if (keepEdge && !transparent && (isSubject(x - 1, y) || isSubject(x + 1, y) || isSubject(x, y - 1) || isSubject(x, y + 1))) {
      continue
    }
    arr[i + 3] = 0
    push(x - 1, y)
    push(x + 1, y)
    push(x, y - 1)
    push(x, y + 1)
  }
}

function colorDist(arr, i, seed) {
  return Math.max(
    Math.abs(arr[i] - seed[0]),
    Math.abs(arr[i + 1] - seed[1]),
    Math.abs(arr[i + 2] - seed[2])
  )
}

/** Clear any remaining pixel close to the background colour (enclosed specks). */
function removeNearColor(arr, cw, ch, tol, seed) {
  for (let i = 0; i < arr.length; i += 4) {
    if (arr[i + 3] > 16 && colorDist(arr, i, seed) <= tol) arr[i + 3] = 0
  }
}

/**
 * Peel away the anti-aliased halo: repeatedly clear opaque pixels that touch a
 * transparent pixel and are still close-ish to the background colour. Several
 * passes remove successive fringe layers without eating the (far-from-bg) subject.
 */
function defringe(arr, cw, ch, fringeTol, seed, passes) {
  for (let p = 0; p < passes; p++) {
    const clear = []
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4
        if (arr[i + 3] <= 16) continue
        const onEdge =
          x === 0 ||
          y === 0 ||
          x === cw - 1 ||
          y === ch - 1 ||
          arr[(y * cw + x - 1) * 4 + 3] <= 16 ||
          arr[(y * cw + x + 1) * 4 + 3] <= 16 ||
          arr[((y - 1) * cw + x) * 4 + 3] <= 16 ||
          arr[((y + 1) * cw + x) * 4 + 3] <= 16
        if (onEdge && colorDist(arr, i, seed) <= fringeTol) clear.push(i)
      }
    }
    if (!clear.length) break
    for (const i of clear) arr[i + 3] = 0
  }
}

/**
 * Keep only the largest connected blob of opaque pixels, dropping floating
 * leftovers (baked-in ground lines, stray specks). The subject of these sprites
 * is a single connected shape, so this is safe.
 */
function keepLargestComponent(arr, cw, ch) {
  const label = new Int32Array(cw * ch).fill(-1)
  const sizes = []
  for (let start = 0; start < cw * ch; start++) {
    if (arr[start * 4 + 3] <= 16 || label[start] !== -1) continue
    const id = sizes.length
    let size = 0
    const stack = [start]
    label[start] = id
    while (stack.length) {
      const p = stack.pop()
      size++
      const x = p % cw
      const y = (p / cw) | 0
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue
        const np = ny * cw + nx
        if (arr[np * 4 + 3] > 16 && label[np] === -1) {
          label[np] = id
          stack.push(np)
        }
      }
    }
    sizes.push(size)
  }
  let best = -1
  let bestSize = 0
  sizes.forEach((s, id) => {
    if (s > bestSize) {
      bestSize = s
      best = id
    }
  })
  for (let p = 0; p < cw * ch; p++) {
    if (arr[p * 4 + 3] > 16 && label[p] !== best) arr[p * 4 + 3] = 0
  }
}

/** Full background cleanup for one cell: flood fill + specks + largest-blob + defringe. */
function removeBackground(arr, cw, ch, cfg) {
  const seed = cfg.seed || [arr[0], arr[1], arr[2]]
  keyOutBackground(arr, cw, ch, cfg.tol, seed, cfg.keepEdge)
  if (!cfg.keepLights) {
    removeNearColor(arr, cw, ch, Math.min(cfg.tol, 50), seed)
    keepLargestComponent(arr, cw, ch)
  }
  // Skip defringe when keepEdge is set — it would erode the outline we kept.
  if (!cfg.keepEdge) {
    defringe(arr, cw, ch, cfg.fringeTol != null ? cfg.fringeTol : cfg.tol + 45, seed, cfg.passes || 3)
  }
}

function bbox(arr, cw, ch) {
  let minX = cw
  let minY = ch
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (arr[(y * cw + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return maxX < 0 ? { minX: 0, minY: 0, maxX: cw - 1, maxY: ch - 1 } : { minX, minY, maxX, maxY }
}

const MAX_SIDE = 128

/** Trim an RGBA cell down to its content bounding box. */
function trim(arr, cw, ch) {
  const b = bbox(arr, cw, ch)
  const w = b.maxX - b.minX + 1
  const h = b.maxY - b.minY + 1
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((b.minY + y) * cw + (b.minX + x)) * 4
      const di = (y * w + x) * 4
      data[di] = arr[si]
      data[di + 1] = arr[si + 1]
      data[di + 2] = arr[si + 2]
      data[di + 3] = arr[si + 3]
    }
  }
  return { data, w, h }
}

/**
 * Center a trimmed frame on a uniform canvas (so the subject sits in the same
 * place every frame -> smooth animation), then downscale if oversized.
 */
function writeFrame(frame, canvasW, canvasH, outPath) {
  const png = new PNG({ width: canvasW, height: canvasH })
  const ox = Math.round((canvasW - frame.w) / 2)
  const oy = Math.round((canvasH - frame.h) / 2)
  for (let y = 0; y < frame.h; y++) {
    for (let x = 0; x < frame.w; x++) {
      const px = ox + x
      const py = oy + y
      if (px < 0 || py < 0 || px >= canvasW || py >= canvasH) continue
      const si = (y * frame.w + x) * 4
      const di = (py * canvasW + px) * 4
      png.data[di] = frame.data[si]
      png.data[di + 1] = frame.data[si + 1]
      png.data[di + 2] = frame.data[si + 2]
      png.data[di + 3] = frame.data[si + 3]
    }
  }
  let buf = PNG.sync.write(png)
  const longest = Math.max(canvasW, canvasH)
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest
    buf = nativeImage
      .createFromBuffer(buf)
      .resize({ width: Math.round(canvasW * scale), height: Math.round(canvasH * scale), quality: 'best' })
      .toPNG()
  }
  fs.writeFileSync(outPath, buf)
}

function processPet(pet, cfg) {
  const dir = path.join(ASSETS, pet)
  // Read the sheet from the assets dir, or from where a prior run moved it.
  const inDir = path.join(dir, cfg.file)
  const moved = path.join(SHEET_OUT, cfg.file)
  const src = fs.existsSync(inDir) ? inDir : moved
  const img = decode(src)
  const cw = Math.floor(img.width / cfg.cols)
  const ch = Math.floor(img.height / cfg.rows)

  // Slice, key out background, then trim each frame to its own content.
  // rowsUsed lets us take just the top N rows of a multi-row sheet.
  const frames = []
  const rowsUsed = cfg.rowsUsed || cfg.rows
  for (let r = 0; r < rowsUsed; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const arr = extract(img, c * cw, r * ch, cw, ch)
      if (cfg.flipX) flipCellX(arr, cw, ch)
      removeBackground(arr, cw, ch, cfg)
      const f = trim(arr, cw, ch)
      // Skip empty cells (e.g. the unused slots of an irregular grid).
      if (f.data.some((v, k) => k % 4 === 3 && v > 16)) frames.push(f)
    }
  }

  // A uniform canvas big enough for every frame; each subject is centered on it.
  const canvasW = Math.max(...frames.map((f) => f.w))
  const canvasH = Math.max(...frames.map((f) => f.h))

  // Remove old frames, write new ones.
  const frameRe = new RegExp(`^${pet}_\\d+\\.png$`)
  for (const f of fs.readdirSync(dir)) if (frameRe.test(f)) fs.unlinkSync(path.join(dir, f))
  frames.forEach((f, i) => writeFrame(f, canvasW, canvasH, path.join(dir, `${pet}_${i + 1}.png`)))

  // Move the source sheet out of the bundled assets dir (if still there).
  fs.mkdirSync(SHEET_OUT, { recursive: true })
  if (src === inDir) {
    if (fs.existsSync(moved)) fs.unlinkSync(moved)
    fs.renameSync(inDir, moved)
  }

  console.log(`${pet}: ${frames.length} frames, canvas ${canvasW}x${canvasH}`)
}

app.whenReady().then(() => {
  for (const [pet, cfg] of Object.entries(SHEETS)) {
    try {
      processPet(pet, cfg)
    } catch (e) {
      console.log(`${pet}: FAILED ${e.message}`)
    }
  }
  app.quit()
})
