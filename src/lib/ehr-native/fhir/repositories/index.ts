/**
 * Repository barrel exports.
 */

export {
  createGenericResource,
  readGenericResource,
  updateGenericResource,
  softDeleteGenericResource,
  searchGenericResources,
  getGenericResourceHistory,
  insertGenericResourceHistory,
} from './generic.js'

export {
  createDedicatedResource,
  readDedicatedResource,
  updateDedicatedResource,
  softDeleteDedicatedResource,
  searchDedicatedResources,
  getDedicatedResourceHistory,
  insertDedicatedResourceHistory,
} from './dedicated.js'
