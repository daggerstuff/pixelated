/**
 * Edge Computing Manager - Default Edge Locations
 *
 * Predefined edge locations covering 90+ global locations across
 * Cloudflare Workers and AWS Lambda@Edge.
 */

import type { EdgeLocation } from './EdgeComputingManager.types'
import { AWS_EDGE_LOCATIONS } from './EdgeComputingManager.locations-aws'
import { CLOUDFLARE_EDGE_LOCATIONS_1 } from './EdgeComputingManager.locations-cloudflare-1'
import { CLOUDFLARE_EDGE_LOCATIONS_2 } from './EdgeComputingManager.locations-cloudflare-2'
import { CLOUDFLARE_EDGE_LOCATIONS_3 } from './EdgeComputingManager.locations-cloudflare-3'
import { CLOUDFLARE_EDGE_LOCATIONS_4 } from './EdgeComputingManager.locations-cloudflare-4'

export const DEFAULT_EDGE_LOCATIONS: EdgeLocation[] = [
  ...AWS_EDGE_LOCATIONS,
  ...CLOUDFLARE_EDGE_LOCATIONS_1,
  ...CLOUDFLARE_EDGE_LOCATIONS_2,
  ...CLOUDFLARE_EDGE_LOCATIONS_3,
  ...CLOUDFLARE_EDGE_LOCATIONS_4,
]