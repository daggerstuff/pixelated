import { realFHEService } from './fhe-service'
import type { FHEKeys } from './types'

export const generateKeys = async (
  config?: Parameters<(typeof realFHEService)['generateKeys']>[0],
): ReturnType<(typeof realFHEService)['generateKeys']> =>
  realFHEService.generateKeys(config)

export const rotateKeys = async (): ReturnType<
  (typeof realFHEService)['rotateKeys']
> => realFHEService.rotateKeys()

export type { FHEKeys }
export { RealFHEService, realFHEService as fheService } from './fhe-service'
