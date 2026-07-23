export {
  API_VERSION,
  API_VERSION_HEADER,
  DEPRECATION_HEADER,
  SUNSET_HEADER,
  ACCEPT_VERSION_HEADER,
  isApiRoute,
  extractVersionFromPath,
  getApiVersion,
  setVersionHeader,
  setDeprecationHeaders,
  createDeprecationInfo,
  getVersionStatus,
} from './versioning'
export type { VersionStatus, DeprecationInfo, VersionInfo } from './versioning'
