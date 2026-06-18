import { PETS, type PetType } from '../shared/types'

/**
 * Eagerly import every pet frame as a URL. Vite resolves these at build time,
 * so packaged builds bundle the PNGs correctly.
 * Keys look like "./assets/cat/cat_1.png".
 */
const frameModules = import.meta.glob<string>('./assets/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
})

/** Extract the trailing number from a filename, e.g. cat_10.png -> 10. */
function frameIndex(path: string): number {
  const match = path.match(/_(\d+)\.png$/)
  return match ? parseInt(match[1], 10) : 0
}

function buildFrames(pet: PetType): string[] {
  return Object.entries(frameModules)
    .filter(([path]) => path.includes(`/assets/${pet}/`) && /_\d+\.png$/.test(path))
    .sort((a, b) => frameIndex(a[0]) - frameIndex(b[0]))
    .map(([, url]) => url)
}

const PET_FRAMES: Record<PetType, string[]> = PETS.reduce(
  (acc, pet) => {
    acc[pet] = buildFrames(pet)
    return acc
  },
  {} as Record<PetType, string[]>
)

export function getFrames(pet: PetType): string[] {
  return PET_FRAMES[pet] ?? []
}
