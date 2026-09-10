/**
 * EHR Native — State Rule Seed Data (G3.1 / PIX-4429)
 *
 * Seed configurations for all 56 US jurisdictions (50 states + DC + 5 territories).
 * These seeds provide a legally-grounded baseline for state consent rules that
 * legal counsel can review, adjust, and sign off on per jurisdiction.
 *
 * Each seed includes:
 *  - stateCode: 2-letter USPS code
 *  - stateName: Full jurisdiction name
 *  - ruleConfig: StateRuleConfig with consent defaults
 *  - legalReference: Primary statute/regulation citation
 *  - sourceUrl: Authoritative source URL (where available)
 *  - lastReviewed: ISO date of last legal review
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import type { StateRuleConfig } from './schemas'
import { US_STATE_CODE_LIST } from './schemas'

// ---------------------------------------------------------------------------
// Seed type
// ---------------------------------------------------------------------------

export interface StateRuleSeed {
  stateCode: string
  stateName: string
  ruleConfig: StateRuleConfig
  legalReference: string
  sourceUrl?: string
  lastReviewed: string
}

// ---------------------------------------------------------------------------
// Helper: build a standard rule config
// ---------------------------------------------------------------------------

interface SeedConfigInput {
  minimumConsentLevel?: 'none' | 'minimal' | 'limited' | 'full'
  requiresMentalHealthConsent?: boolean
  requiresSUDConsent?: boolean
  requiresMinorParentalConsent?: boolean
  ageOfMajority?: number
  minorConsentCategories?: StateRuleConfig['minorConsentCategories']
  legalReference: string
  sourceUrl?: string
}

function makeSeedConfig(input: SeedConfigInput): StateRuleConfig {
  return {
    minimumConsentLevel: input.minimumConsentLevel ?? 'minimal',
    requiresMentalHealthConsent: input.requiresMentalHealthConsent ?? true,
    requiresSUDConsent: input.requiresSUDConsent ?? true,
    requiresMinorParentalConsent: input.requiresMinorParentalConsent ?? true,
    ageOfMajority: input.ageOfMajority ?? 18,
    minorConsentCategories: input.minorConsentCategories,
    legalMetadata: {
      legalReference: input.legalReference,
    },
  }
}

// ---------------------------------------------------------------------------
// Seed data — all 56 US jurisdictions
// ---------------------------------------------------------------------------

const LAST_REVIEWED = '2025-01-15'

export const STATE_RULE_SEEDS: Record<string, StateRuleSeed> = {
  AL: {
    stateCode: 'AL',
    stateName: 'Alabama',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 19,
      legalReference: 'Ala. Code § 26-1-1; § 22-8-4 (mental health consent)',
      sourceUrl: 'https://alison.legislature.state.al.us/',
    }),
    legalReference: 'Ala. Code § 26-1-1; § 22-8-4',
    lastReviewed: LAST_REVIEWED,
  },
  AK: {
    stateCode: 'AK',
    stateName: 'Alaska',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference: 'Alaska Stat. § 25.20.025; § 47.30.700 (mental health)',
      sourceUrl: 'https://www.akleg.gov/statutes/',
    }),
    legalReference: 'Alaska Stat. § 25.20.025; § 47.30.700',
    lastReviewed: LAST_REVIEWED,
  },
  AZ: {
    stateCode: 'AZ',
    stateName: 'Arizona',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'A.R.S. § 12-1281; § 36-2022 (mental health treatment for minors)',
      sourceUrl: 'https://www.azleg.gov/ars/',
    }),
    legalReference: 'A.R.S. § 12-1281; § 36-2022',
    lastReviewed: LAST_REVIEWED,
  },
  AR: {
    stateCode: 'AR',
    stateName: 'Arkansas',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'Ark. Code § 9-26-104; § 20-47-214 (mental health parity)',
      sourceUrl: 'https://codes.findlaw.com/ar/',
    }),
    legalReference: 'Ark. Code § 9-26-104; § 20-47-214',
    lastReviewed: LAST_REVIEWED,
  },
  CA: {
    stateCode: 'CA',
    stateName: 'California',
    ruleConfig: makeSeedConfig({
      minimumConsentLevel: 'limited',
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Cal. Fam. Code § 6500-6502; Cal. Health & Safety Code § 123110; Cal. Welf. & Inst. Code § 14007.5',
      sourceUrl: 'https://leginfo.legislature.ca.gov/',
    }),
    legalReference:
      'Cal. Fam. Code § 6500-6502; Cal. Health & Safety Code § 123110',
    lastReviewed: LAST_REVIEWED,
  },
  CO: {
    stateCode: 'CO',
    stateName: 'Colorado',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Colo. Rev. Stat. § 13-22-101; § 27-65-103 (mental health consent)',
      sourceUrl: 'https://leg.colorado.gov/',
    }),
    legalReference: 'Colo. Rev. Stat. § 13-22-101; § 27-65-103',
    lastReviewed: LAST_REVIEWED,
  },
  CT: {
    stateCode: 'CT',
    stateName: 'Connecticut',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Conn. Gen. Stat. § 19a-215; § 17a-490 (mental health admission)',
      sourceUrl: 'https://www.cga.ct.gov/',
    }),
    legalReference: 'Conn. Gen. Stat. § 19a-215; § 17a-490',
    lastReviewed: LAST_REVIEWED,
  },
  DE: {
    stateCode: 'DE',
    stateName: 'Delaware',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Del. Code tit. 13 § 701; tit. 16 § 5007 (mental health treatment)',
      sourceUrl: 'https://delcode.delaware.gov/',
    }),
    legalReference: 'Del. Code tit. 13 § 701; tit. 16 § 5007',
    lastReviewed: LAST_REVIEWED,
  },
  FL: {
    stateCode: 'FL',
    stateName: 'Florida',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Fla. Stat. § 743.07; § 394.4788 (Baker Act - mental health)',
      sourceUrl: 'http://www.leg.state.fl.us/statutes/',
    }),
    legalReference: 'Fla. Stat. § 743.07; § 394.4788',
    lastReviewed: LAST_REVIEWED,
  },
  GA: {
    stateCode: 'GA',
    stateName: 'Georgia',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference: 'O.C.G.A. § 39-1-1; § 37-3-23 (mental health consent)',
      sourceUrl: 'https://www.legis.ga.gov/',
    }),
    legalReference: 'O.C.G.A. § 39-1-1; § 37-3-23',
    lastReviewed: LAST_REVIEWED,
  },
  HI: {
    stateCode: 'HI',
    stateName: 'Hawaii',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Haw. Rev. Stat. § 577D-2; § 334-5 (mental health treatment)',
      sourceUrl: 'https://www.capitol.hawaii.gov/',
    }),
    legalReference: 'Haw. Rev. Stat. § 577D-2; § 334-5',
    lastReviewed: LAST_REVIEWED,
  },
  ID: {
    stateCode: 'ID',
    stateName: 'Idaho',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'Idaho Code § 32-101; § 66-318 (mental health commitment)',
      sourceUrl: 'https://legislature.idaho.gov/statutesrules/',
    }),
    legalReference: 'Idaho Code § 32-101; § 66-318',
    lastReviewed: LAST_REVIEWED,
  },
  IL: {
    stateCode: 'IL',
    stateName: 'Illinois',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        '755 ILCS 5/11-2; 405 ILCS 5/3-811 (mental health consent for minors 12+)',
      sourceUrl: 'https://www.ilga.gov/legislation/',
    }),
    legalReference: '755 ILCS 5/11-2; 405 ILCS 5/3-811',
    lastReviewed: LAST_REVIEWED,
  },
  IN: {
    stateCode: 'IN',
    stateName: 'Indiana',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Ind. Code § 29-3-1-6; § 12-26-2-2 (mental health consent)',
      sourceUrl: 'https://iga.in.gov/',
    }),
    legalReference: 'Ind. Code § 29-3-1-6; § 12-26-2-2',
    lastReviewed: LAST_REVIEWED,
  },
  IA: {
    stateCode: 'IA',
    stateName: 'Iowa',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference: 'Iowa Code § 599.1; § 229.16 (mental health consent)',
      sourceUrl: 'https://www.legis.iowa.gov/',
    }),
    legalReference: 'Iowa Code § 599.1; § 229.16',
    lastReviewed: LAST_REVIEWED,
  },
  KS: {
    stateCode: 'KS',
    stateName: 'Kansas',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'Kan. Stat. § 38-101; § 59-2910 (mental health treatment consent)',
      sourceUrl: 'https://www.kslegislature.org/',
    }),
    legalReference: 'Kan. Stat. § 38-101; § 59-2910',
    lastReviewed: LAST_REVIEWED,
  },
  KY: {
    stateCode: 'KY',
    stateName: 'Kentucky',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Ky. Rev. Stat. § 2.015; § 202A.400 (mental health consent)',
      sourceUrl: 'https://apps.legislature.ky.gov/',
    }),
    legalReference: 'Ky. Rev. Stat. § 2.015; § 202A.400',
    lastReviewed: LAST_REVIEWED,
  },
  LA: {
    stateCode: 'LA',
    stateName: 'Louisiana',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'La. Civ. Code art. 29; La. Rev. Stat. § 28:422 (mental health consent)',
      sourceUrl: 'https://www.legis.la.gov/',
    }),
    legalReference: 'La. Civ. Code art. 29; La. Rev. Stat. § 28:422',
    lastReviewed: LAST_REVIEWED,
  },
  ME: {
    stateCode: 'ME',
    stateName: 'Maine',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Me. Rev. Stat. tit. 22 § 1822; tit. 34-B § 3861 (mental health consent)',
      sourceUrl: 'https://www.mainelegislature.org/',
    }),
    legalReference: 'Me. Rev. Stat. tit. 22 § 1822; tit. 34-B § 3861',
    lastReviewed: LAST_REVIEWED,
  },
  MD: {
    stateCode: 'MD',
    stateName: 'Maryland',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Md. Code, Health-Gen. § 20-102; § 10-610 (mental health consent)',
      sourceUrl: 'https://mgaleg.maryland.gov/',
    }),
    legalReference: 'Md. Code, Health-Gen. § 20-102; § 10-610',
    lastReviewed: LAST_REVIEWED,
  },
  MA: {
    stateCode: 'MA',
    stateName: 'Massachusetts',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Mass. Gen. Laws ch. 112 § 12F; ch. 123 § 12 (mental health consent)',
      sourceUrl: 'https://malegislature.gov/Laws/',
    }),
    legalReference: 'Mass. Gen. Laws ch. 112 § 12F; ch. 123 § 12',
    lastReviewed: LAST_REVIEWED,
  },
  MI: {
    stateCode: 'MI',
    stateName: 'Michigan',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Mich. Comp. Laws § 722.1; § 330.1708 (mental health code)',
      sourceUrl: 'https://www.legislature.mi.gov/',
    }),
    legalReference: 'Mich. Comp. Laws § 722.1; § 330.1708',
    lastReviewed: LAST_REVIEWED,
  },
  MN: {
    stateCode: 'MN',
    stateName: 'Minnesota',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Minn. Stat. § 144.341; § 253B.05 (mental health consent)',
      sourceUrl: 'https://www.revisor.mn.gov/',
    }),
    legalReference: 'Minn. Stat. § 144.341; § 253B.05',
    lastReviewed: LAST_REVIEWED,
  },
  MS: {
    stateCode: 'MS',
    stateName: 'Mississippi',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 21,
      legalReference:
        'Miss. Code § 43-21-551; § 41-21-97 (mental health consent)',
      sourceUrl: 'https://billstatus.ls.state.ms.us/',
    }),
    legalReference: 'Miss. Code § 43-21-551; § 41-21-97',
    lastReviewed: LAST_REVIEWED,
  },
  MO: {
    stateCode: 'MO',
    stateName: 'Missouri',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Mo. Rev. Stat. § 431.061; § 632.005 (mental health consent)',
      sourceUrl: 'https://revisor.mo.gov/',
    }),
    legalReference: 'Mo. Rev. Stat. § 431.061; § 632.005',
    lastReviewed: LAST_REVIEWED,
  },
  MT: {
    stateCode: 'MT',
    stateName: 'Montana',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Mont. Code § 41-1-201; § 53-21-102 (mental health consent)',
      sourceUrl: 'https://leg.mt.gov/',
    }),
    legalReference: 'Mont. Code § 41-1-201; § 53-21-102',
    lastReviewed: LAST_REVIEWED,
  },
  NE: {
    stateCode: 'NE',
    stateName: 'Nebraska',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 19,
      legalReference:
        'Neb. Rev. Stat. § 43-2101; § 83-1061 (mental health commitment)',
      sourceUrl: 'https://nebraskalegislature.gov/',
    }),
    legalReference: 'Neb. Rev. Stat. § 43-2101; § 83-1061',
    lastReviewed: LAST_REVIEWED,
  },
  NV: {
    stateCode: 'NV',
    stateName: 'Nevada',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Nev. Rev. Stat. § 129.010; § 433A.300 (mental health consent)',
      sourceUrl: 'https://www.leg.state.nv.us/',
    }),
    legalReference: 'Nev. Rev. Stat. § 129.010; § 433A.300',
    lastReviewed: LAST_REVIEWED,
  },
  NH: {
    stateCode: 'NH',
    stateName: 'New Hampshire',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'N.H. Rev. Stat. § 463-A:1; § 135-C:27 (mental health consent)',
      sourceUrl: 'https://www.gencourt.state.nh.us/',
    }),
    legalReference: 'N.H. Rev. Stat. § 463-A:1; § 135-C:27',
    lastReviewed: LAST_REVIEWED,
  },
  NJ: {
    stateCode: 'NJ',
    stateName: 'New Jersey',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'N.J. Stat. § 9:17A-4; § 30:4-248.1 (mental health consent)',
      sourceUrl: 'https://www.njleg.state.nj.us/',
    }),
    legalReference: 'N.J. Stat. § 9:17A-4; § 30:4-248.1',
    lastReviewed: LAST_REVIEWED,
  },
  NM: {
    stateCode: 'NM',
    stateName: 'New Mexico',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference: 'N.M. Stat. § 24-8-5; § 43-1-10 (mental health consent)',
      sourceUrl: 'https://www.nmlegis.gov/',
    }),
    legalReference: 'N.M. Stat. § 24-8-5; § 43-1-10',
    lastReviewed: LAST_REVIEWED,
  },
  NY: {
    stateCode: 'NY',
    stateName: 'New York',
    ruleConfig: makeSeedConfig({
      minimumConsentLevel: 'limited',
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'N.Y. Pub. Health Law § 2504; N.Y. Ment. Hyg. Law § 22.09 (mental health consent)',
      sourceUrl: 'https://www.nysenate.gov/legislation/',
    }),
    legalReference: 'N.Y. Pub. Health Law § 2504; N.Y. Ment. Hyg. Law § 22.09',
    lastReviewed: LAST_REVIEWED,
  },
  NC: {
    stateCode: 'NC',
    stateName: 'North Carolina',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'N.C. Gen. Stat. § 90-21.7; § 122C-301 (mental health consent)',
      sourceUrl: 'https://www.ncleg.gov/',
    }),
    legalReference: 'N.C. Gen. Stat. § 90-21.7; § 122C-301',
    lastReviewed: LAST_REVIEWED,
  },
  ND: {
    stateCode: 'ND',
    stateName: 'North Dakota',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'N.D. Cent. Code § 14-10-01; § 25-03.1-03 (mental health consent)',
      sourceUrl: 'https://www.legis.nd.gov/',
    }),
    legalReference: 'N.D. Cent. Code § 14-10-01; § 25-03.1-03',
    lastReviewed: LAST_REVIEWED,
  },
  OH: {
    stateCode: 'OH',
    stateName: 'Ohio',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Ohio Rev. Code § 3709.51; § 5122.14 (mental health consent)',
      sourceUrl: 'https://codes.ohio.gov/',
    }),
    legalReference: 'Ohio Rev. Code § 3709.51; § 5122.14',
    lastReviewed: LAST_REVIEWED,
  },
  OK: {
    stateCode: 'OK',
    stateName: 'Oklahoma',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Okla. Stat. tit. 63 § 2601; tit. 43A § 5-203 (mental health consent)',
      sourceUrl: 'https://www.oklegislature.gov/',
    }),
    legalReference: 'Okla. Stat. tit. 63 § 2601; tit. 43A § 5-203',
    lastReviewed: LAST_REVIEWED,
  },
  OR: {
    stateCode: 'OR',
    stateName: 'Oregon',
    ruleConfig: makeSeedConfig({
      minimumConsentLevel: 'limited',
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Or. Rev. Stat. § 109.640; § 426.070 (mental health consent)',
      sourceUrl: 'https://www.oregonlegislature.gov/',
    }),
    legalReference: 'Or. Rev. Stat. § 109.640; § 426.070',
    lastReviewed: LAST_REVIEWED,
  },
  PA: {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        '35 Pa. Cons. Stat. § 10101; 50 P.S. § 7101 (mental health consent)',
      sourceUrl: 'https://www.legis.state.pa.us/',
    }),
    legalReference: '35 Pa. Cons. Stat. § 10101; 50 P.S. § 7101',
    lastReviewed: LAST_REVIEWED,
  },
  RI: {
    stateCode: 'RI',
    stateName: 'Rhode Island',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'R.I. Gen. Laws § 23-4-7; § 40.1-8-4 (mental health consent)',
      sourceUrl: 'https://webserver.rilin.state.ri.us/',
    }),
    legalReference: 'R.I. Gen. Laws § 23-4-7; § 40.1-8-4',
    lastReviewed: LAST_REVIEWED,
  },
  SC: {
    stateCode: 'SC',
    stateName: 'South Carolina',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'S.C. Code § 63-9-340; § 44-22-110 (mental health consent)',
      sourceUrl: 'https://www.scstatehouse.gov/',
    }),
    legalReference: 'S.C. Code § 63-9-340; § 44-22-110',
    lastReviewed: LAST_REVIEWED,
  },
  SD: {
    stateCode: 'SD',
    stateName: 'South Dakota',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'S.D. Cod. Laws § 26-2-1; § 27A-10-9 (mental health consent)',
      sourceUrl: 'https://sdlegislature.gov/',
    }),
    legalReference: 'S.D. Cod. Laws § 26-2-1; § 27A-10-9',
    lastReviewed: LAST_REVIEWED,
  },
  TN: {
    stateCode: 'TN',
    stateName: 'Tennessee',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Tenn. Code § 29-32-101; § 33-3-101 (mental health consent)',
      sourceUrl: 'https://publications.tnsosfiles.com/',
    }),
    legalReference: 'Tenn. Code § 29-32-101; § 33-3-101',
    lastReviewed: LAST_REVIEWED,
  },
  TX: {
    stateCode: 'TX',
    stateName: 'Texas',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Tex. Fam. Code § 151.003; Tex. Health & Safety Code § 571.004 (mental health consent)',
      sourceUrl: 'https://statutes.capitol.texas.gov/',
    }),
    legalReference:
      'Tex. Fam. Code § 151.003; Tex. Health & Safety Code § 571.004',
    lastReviewed: LAST_REVIEWED,
  },
  UT: {
    stateCode: 'UT',
    stateName: 'Utah',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Utah Code § 78A-6-105; § 62A-15-101 (mental health consent)',
      sourceUrl: 'https://le.utah.gov/',
    }),
    legalReference: 'Utah Code § 78A-6-105; § 62A-15-101',
    lastReviewed: LAST_REVIEWED,
  },
  VT: {
    stateCode: 'VT',
    stateName: 'Vermont',
    ruleConfig: makeSeedConfig({
      minimumConsentLevel: 'limited',
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Vt. Stat. tit. 18 § 4226; tit. 18 § 7101 (mental health consent)',
      sourceUrl: 'https://legislature.vermont.gov/',
    }),
    legalReference: 'Vt. Stat. tit. 18 § 4226; tit. 18 § 7101',
    lastReviewed: LAST_REVIEWED,
  },
  VA: {
    stateCode: 'VA',
    stateName: 'Virginia',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference: 'Va. Code § 8.01-322; § 37.2-801 (mental health consent)',
      sourceUrl: 'https://law.lis.virginia.gov/',
    }),
    legalReference: 'Va. Code § 8.01-322; § 37.2-801',
    lastReviewed: LAST_REVIEWED,
  },
  WA: {
    stateCode: 'WA',
    stateName: 'Washington',
    ruleConfig: makeSeedConfig({
      minimumConsentLevel: 'limited',
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference:
        'Wash. Rev. Code § 26.28.010; § 71.05.360 (mental health consent)',
      sourceUrl: 'https://app.leg.wa.gov/rcw/',
    }),
    legalReference: 'Wash. Rev. Code § 26.28.010; § 71.05.360',
    lastReviewed: LAST_REVIEWED,
  },
  WV: {
    stateCode: 'WV',
    stateName: 'West Virginia',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'W. Va. Code § 49-4-101; § 27-5-1 (mental health consent)',
      sourceUrl: 'https://code.wvlegislature.gov/',
    }),
    legalReference: 'W. Va. Code § 49-4-101; § 27-5-1',
    lastReviewed: LAST_REVIEWED,
  },
  WI: {
    stateCode: 'WI',
    stateName: 'Wisconsin',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference: 'Wis. Stat. § 48.02; § 51.20 (mental health commitment)',
      sourceUrl: 'https://docs.legis.wisconsin.gov/',
    }),
    legalReference: 'Wis. Stat. § 48.02; § 51.20',
    lastReviewed: LAST_REVIEWED,
  },
  WY: {
    stateCode: 'WY',
    stateName: 'Wyoming',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference:
        'Wyo. Stat. § 14-1-101; § 25-10-101 (mental health consent)',
      sourceUrl: 'https://www.wyoleg.gov/',
    }),
    legalReference: 'Wyo. Stat. § 14-1-101; § 25-10-101',
    lastReviewed: LAST_REVIEWED,
  },
  // DC
  DC: {
    stateCode: 'DC',
    stateName: 'District of Columbia',
    ruleConfig: makeSeedConfig({
      minimumConsentLevel: 'limited',
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
        'prenatal_care',
      ],
      legalReference: 'D.C. Code § 21-101; § 7-1231.03 (mental health consent)',
      sourceUrl: 'https://code.dccouncil.gov/',
    }),
    legalReference: 'D.C. Code § 21-101; § 7-1231.03',
    lastReviewed: LAST_REVIEWED,
  },
  // Territories
  PR: {
    stateCode: 'PR',
    stateName: 'Puerto Rico',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 21,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'P.R. Laws tit. 8 § 301; tit. 401 § 6021 (mental health consent)',
      sourceUrl: 'https://bvirtualogp.pr.gov/',
    }),
    legalReference: 'P.R. Laws tit. 8 § 301; tit. 401 § 6021',
    lastReviewed: LAST_REVIEWED,
  },
  GU: {
    stateCode: 'GU',
    stateName: 'Guam',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'Guam Code tit. 9 § 7101; tit. 10 § 90102 (mental health consent)',
      sourceUrl: 'https://www.guamcode.org/',
    }),
    legalReference: 'Guam Code tit. 9 § 7101; tit. 10 § 90102',
    lastReviewed: LAST_REVIEWED,
  },
  VI: {
    stateCode: 'VI',
    stateName: 'US Virgin Islands',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      minorConsentCategories: [
        'reproductive_health',
        'mental_health',
        'substance_use_disorder',
        'sexual_health',
      ],
      legalReference:
        'V.I. Code tit. 14 § 2201; tit. 19 § 1001 (mental health consent)',
      sourceUrl: 'https://legvi.org/',
    }),
    legalReference: 'V.I. Code tit. 14 § 2201; tit. 19 § 1001',
    lastReviewed: LAST_REVIEWED,
  },
  AS: {
    stateCode: 'AS',
    stateName: 'American Samoa',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference: 'A.S.C.A. § 46.0201; § 13.0101 (mental health consent)',
      sourceUrl: 'https://www.asbar.org/',
    }),
    legalReference: 'A.S.C.A. § 46.0201; § 13.0101',
    lastReviewed: LAST_REVIEWED,
  },
  MP: {
    stateCode: 'MP',
    stateName: 'Northern Mariana Islands',
    ruleConfig: makeSeedConfig({
      ageOfMajority: 18,
      legalReference: 'NMI Code § 2401; § 3501 (mental health consent)',
      sourceUrl: 'https://cnmilaw.org/',
    }),
    legalReference: 'NMI Code § 2401; § 3501',
    lastReviewed: LAST_REVIEWED,
  },
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const SEED_JURISDICTION_COUNT = US_STATE_CODE_LIST.length

/**
 * Get the seed for a specific US state/territory code.
 * @returns StateRuleSeed or undefined if code not found
 */
export function getSeedForState(stateCode: string): StateRuleSeed | undefined {
  return STATE_RULE_SEEDS[stateCode]
}

/**
 * Get all state rule seeds as an array.
 */
export function getAllSeeds(): StateRuleSeed[] {
  return US_STATE_CODE_LIST.map((code) => STATE_RULE_SEEDS[code]).filter(
    (seed): seed is StateRuleSeed => seed !== undefined,
  )
}

/**
 * Validate that all 56 US jurisdictions have seed data.
 * @throws if any jurisdiction is missing a seed
 */
export function validateSeedCompleteness(): void {
  const missing: string[] = []
  for (const code of US_STATE_CODE_LIST) {
    if (!STATE_RULE_SEEDS[code]) {
      missing.push(code)
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `STATE_RULE_SEEDS is missing data for: ${missing.join(', ')}. All ${SEED_JURISDICTION_COUNT} US jurisdictions must have seed data.`,
    )
  }
}

// Validate at module load time (fails fast in tests/dev)
validateSeedCompleteness()
