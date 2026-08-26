import type { BaaTemplateSection, BaaPlaceholder } from '../types'

/**
 * Standard HIPAA BAA template sections
 */
export const standardSections: BaaTemplateSection[] = [
  {
    id: 'definitions',
    title: 'Definitions',
    description: 'Defines key terms used throughout the agreement',
    content:
      'For the purposes of this Agreement, the following definitions shall apply:\n\n' +
      '1.1. **Business Associate** shall mean {{BUSINESS_ASSOCIATE_NAME}}.\n\n' +
      '1.2. **Covered Entity** shall mean {{COVERED_ENTITY_NAME}}.\n\n' +
      '1.3. **HIPAA** shall mean the Health Insurance Portability and Accountability Act of 1996, Public Law 104-191, as amended by the Health Information Technology for Economic and Clinical Health Act, Public Law 111-005, and related regulations.\n\n' +
      '1.4. **Protected Health Information** or **PHI** shall have the same meaning as the term "protected health information" in 45 CFR § 160.103, limited to the information created, received, maintained, or transmitted by Business Associate on behalf of Covered Entity.',
    required: true,
    order: 0,
  },
  {
    id: 'obligations',
    title: 'Obligations of Business Associate',
    description: 'Outlines the core responsibilities of the Business Associate',
    content:
      'Business Associate agrees to:\n\n' +
      '2.1. Not use or disclose PHI other than as permitted or required by this Agreement or as required by law.\n\n' +
      '2.2. Use appropriate safeguards, and comply with Subpart C of 45 CFR Part 164 with respect to electronic PHI, to prevent use or disclosure of PHI other than as provided for by this Agreement.\n\n' +
      '2.3. Report to Covered Entity any use or disclosure of PHI not provided for by this Agreement of which it becomes aware, including breaches of unsecured PHI as required by 45 CFR § 164.410, and any security incident of which it becomes aware.\n\n' +
      '2.4. In accordance with 45 CFR §§ 164.502(e)(1)(ii) and 164.308(b)(2), ensure that any subcontractors that create, receive, maintain, or transmit PHI on behalf of the Business Associate agree to the same restrictions, conditions, and requirements that apply to the Business Associate with respect to such information.',
    required: true,
    order: 1,
  },
  {
    id: 'permitted-uses',
    title: 'Permitted Uses and Disclosures',
    description: 'Specifies allowed uses of protected health information',
    content:
      'Business Associate may only use or disclose PHI as necessary to perform the services set forth in the Service Agreement between the parties, provided that such use or disclosure would not violate HIPAA if done by Covered Entity.\n\n' +
      'Business Associate may use or disclose PHI as required by law.\n\n' +
      "Business Associate agrees to make uses and disclosures and requests for PHI consistent with Covered Entity's minimum necessary policies and procedures.",
    required: true,
    order: 2,
  },
  {
    id: 'covered-entity-obligations',
    title: 'Obligations of Covered Entity',
    description: 'Specifies the responsibilities of the Covered Entity',
    content:
      'Covered Entity shall:\n\n' +
      "4.1. Notify Business Associate of any limitation(s) in the notice of privacy practices of Covered Entity under 45 CFR § 164.520, to the extent that such limitation may affect Business Associate's use or disclosure of PHI.\n\n" +
      "4.2. Notify Business Associate of any changes in, or revocation of, the permission by an individual to use or disclose his or her PHI, to the extent that such changes may affect Business Associate's use or disclosure of PHI.\n\n" +
      "4.3. Notify Business Associate of any restriction on the use or disclosure of PHI that Covered Entity has agreed to or is required to abide by under 45 CFR § 164.522, to the extent that such restriction may affect Business Associate's use or disclosure of PHI.",
    required: true,
    order: 3,
  },
  {
    id: 'term-termination',
    title: 'Term and Termination',
    description: 'Defines the agreement duration and termination conditions',
    content:
      '5.1. **Term**. The Term of this Agreement shall be effective as of {{EFFECTIVE_DATE}}, and shall terminate on the earlier of (a) the termination of the Service Agreement, or (b) the date either party terminates for cause as authorized in Section 5.2.\n\n' +
      '5.2. **Termination for Cause**. Either party may terminate this Agreement for cause if it determines that the other party has violated a material term of the Agreement and has not cured the breach within {{CURE_PERIOD}} days after written notice of such breach.\n\n' +
      '5.3. **Obligations upon Termination**. Upon termination of this Agreement for any reason, Business Associate shall return to Covered Entity or, if agreed to by Covered Entity, destroy all PHI received from Covered Entity, or created, maintained, or received by Business Associate on behalf of Covered Entity. Business Associate shall retain no copies of the PHI. If return or destruction is infeasible, the protections of this Agreement shall continue to apply to such PHI, and Business Associate shall limit further uses and disclosures of such PHI to those purposes that make the return or destruction infeasible.',
    required: true,
    order: 4,
  },
  {
    id: 'miscellaneous',
    title: 'Miscellaneous',
    description: 'Includes additional legal provisions and requirements',
    content:
      '6.1. **Regulatory References**. A reference in this Agreement to a section in HIPAA means the section as in effect or as amended.\n\n' +
      '6.2. **Amendment**. The Parties agree to take such action as is necessary to amend this Agreement from time to time as is necessary for compliance with the requirements of HIPAA.\n\n' +
      '6.3. **Interpretation**. Any ambiguity in this Agreement shall be interpreted to permit compliance with HIPAA.\n\n' +
      '6.4. **No Third-Party Beneficiaries**. Nothing in this Agreement shall confer upon any person other than the parties and their respective successors or assigns, any rights, remedies, obligations, or liabilities whatsoever.\n\n' +
      '6.5. **Governing Law**. This Agreement shall be governed by and construed in accordance with the laws of {{GOVERNING_LAW_STATE}}, without regard to its conflict of laws principles.',
    required: true,
    order: 5,
  },
  {
    id: 'special-provisions',
    title: 'Special Provisions',
    description:
      'Additional provisions specific to certain business relationships or use cases',
    content:
      "7.1. **Fully Homomorphic Encryption**. When processing electronic PHI, Business Associate will utilize Fully Homomorphic Encryption (FHE) capabilities provided by Covered Entity when available and appropriate for the specific processing needs. For PHI that is processed using Covered Entity's FHE systems, Business Associate acknowledges that it will not have access to unencrypted PHI and will only perform operations on the encrypted data as authorized.\n\n" +
      '7.2. **Security Certifications**. Business Associate represents and warrants that it has implemented security measures that meet or exceed industry standards required for handling and processing PHI, including {{SECURITY_CERTIFICATIONS}}.\n\n' +
      "7.3. **Audit Rights**. Covered Entity shall have the right, upon reasonable notice, to audit Business Associate's compliance with this Agreement, including but not limited to its privacy and security policies, procedures, and practices relating to the PHI received, created, maintained, or transmitted by Business Associate on behalf of Covered Entity.",
    required: false,
    order: 6,
  },
  {
    id: 'data-breach-procedure',
    title: 'Data Breach Procedure',
    description: 'Detailed procedure for handling data breaches',
    content:
      '8.1. **Breach Notification**. Business Associate shall notify Covered Entity of any Breach of Unsecured Protected Health Information without unreasonable delay and in no case later than {{BREACH_NOTIFICATION_PERIOD}} calendar days after discovery of a Breach.\n\n' +
      '8.2. **Notification Content**. The notification shall include, to the extent possible, the identification of each individual whose Unsecured Protected Health Information has been, or is reasonably believed by Business Associate to have been, accessed, acquired, used, or disclosed during the Breach. Business Associate shall also provide Covered Entity with any other available information that Covered Entity is required to include in notification to the individual under 45 CFR § 164.404(c).\n\n' +
      '8.3. **Investigation and Mitigation**. Business Associate agrees to investigate the Breach, to identify the root cause, and to implement appropriate remediation measures to prevent similar Breaches in the future.',
    required: false,
    order: 7,
  },
  {
    id: 'insurance',
    title: 'Insurance',
    description: 'Insurance requirements for the Business Associate',
    content:
      'Business Associate shall maintain insurance coverage sufficient to cover its responsibilities and liabilities under this Agreement, including but not limited to cyber liability insurance coverage with a policy limit of not less than {{INSURANCE_COVERAGE_AMOUNT}} per occurrence.\n\n' +
      'Business Associate shall provide proof of such insurance coverage to Covered Entity upon request.',
    required: false,
    order: 8,
  },
]

/**
 * Standard BAA placeholder definitions
 */
export const standardPlaceholders: BaaPlaceholder[] = [
  {
    key: 'BUSINESS_ASSOCIATE_NAME',
    label: 'Business Associate Name',
    description: 'Legal name of the business associate or vendor',
    required: true,
  },
  {
    key: 'COVERED_ENTITY_NAME',
    label: 'Covered Entity Name',
    description: 'Legal name of the covered entity (your organization)',
    required: true,
  },
  {
    key: 'EFFECTIVE_DATE',
    label: 'Effective Date',
    description: 'Date when the agreement goes into effect (MM/DD/YYYY)',
    required: true,
  },
  {
    key: 'CURE_PERIOD',
    label: 'Cure Period',
    description:
      'Number of days allowed to fix a material breach of the agreement',
    required: true,
    defaultValue: '30',
  },
  {
    key: 'GOVERNING_LAW_STATE',
    label: 'Governing Law State',
    description: 'State whose laws govern this agreement',
    required: true,
  },
  {
    key: 'SECURITY_CERTIFICATIONS',
    label: 'Security Certifications',
    description:
      'Security certifications held by the business associate (e.g., SOC 2, HITRUST, ISO 27001)',
    required: false,
    defaultValue: 'SOC 2 Type II certification',
  },
  {
    key: 'BREACH_NOTIFICATION_PERIOD',
    label: 'Breach Notification Period',
    description:
      'Number of days within which the business associate must notify the covered entity of a breach',
    required: false,
    defaultValue: '5',
  },
  {
    key: 'INSURANCE_COVERAGE_AMOUNT',
    label: 'Insurance Coverage Amount',
    description:
      'Minimum insurance coverage amount required (e.g., $1,000,000)',
    required: false,
    defaultValue: '$2,000,000',
  },
]
