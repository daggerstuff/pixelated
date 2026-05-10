import { generateKeys, rotateKeys } from './fhe-service';
import type { FHEKeys } from './fhe-service';
export { generateKeys, rotateKeys };
export type { FHEKeys };
export { RealFHEService, realFHEService as fheService } from './fhe-service';