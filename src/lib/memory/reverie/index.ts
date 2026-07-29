export { FishhookDetector } from "./fishhook-detector";
export { LatentSurfacer } from "./latent-surfacer";
export { SoftInjector } from "./soft-injector";
export type { InjectionResult } from "./soft-injector";
export { ReverieEngine } from "./reverie-engine";

// Re-export types from the central type definition file
export type {
  ReveriePhase,
  FishhookMatch,
  FishhookMatchType,
  ReverieVector,
  ReverieConfig,
  ReverieResult,
  ReverieSeed,
  ReverieSeedResult,
} from "../../../types/reverie";

export { DEFAULT_REVERIE_CONFIG } from "../../../types/reverie";
