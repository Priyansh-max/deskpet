import Store from 'electron-store'
import { DEFAULT_PREFERENCES, PETS, type PetType, type Preferences } from '../shared/types'

/**
 * Persistent preferences backed by electron-store.
 * Stored on disk under the app's userData directory.
 */
const store = new Store<Preferences>({
  defaults: DEFAULT_PREFERENCES
})

export function getSelectedPet(): PetType {
  const pet = store.get('selectedPet')
  return PETS.includes(pet) ? pet : DEFAULT_PREFERENCES.selectedPet
}

export function setSelectedPet(pet: PetType): void {
  store.set('selectedPet', pet)
}
