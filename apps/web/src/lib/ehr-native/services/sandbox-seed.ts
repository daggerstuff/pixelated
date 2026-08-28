/**
 * Sandbox tenant seed script — pre-seeds test data for developer sandbox tenants.
 *
 * Creates a deterministic set of FHIR R4 resources (patients, encounters, observations)
 * so developers can exercise the EHR API against realistic data without PHI.
 *
 * Usage:
 *   npx tsx src/lib/ehr-native/services/sandbox-seed.ts --tenant <tenant-id>
 *   npx tsx src/lib/ehr-native/services/sandbox-seed.ts --tenant sandbox-001 --reset
 *
 * All data is synthetic. No real PHI is used.
 */

import { transaction } from '../../db';
import { PatientRepository } from '../repositories/patient-repository';
import { EncounterRepository } from '../repositories/encounter-repository';
import { ObservationRepository } from '../repositories/observation-repository';
import type { RLSContext } from '../repositories';

// ─── Types ──────────────────────────────────────────────

export interface SandboxSeedOptions {
  tenantId: string;
  reset?: boolean;
}

export interface SandboxSeedResult {
  tenantId: string;
  patientsCreated: number;
  encountersCreated: number;
  observationsCreated: number;
  patientIds: string[];
  encounterIds: string[];
  observationIds: string[];
}

// ─── Synthetic Data ────────────────────────────────────

/**
 * Synthetic patient fixtures (5 patients).
 * Deterministic IDs for predictable API testing.
 */
const SYNTHETIC_PATIENTS = [
  {
    id: 'sandbox-patient-001',
    identifier: [{ system: 'http://pixelated.com/mrn', value: 'SANDBOX-MRN-001' }],
    name: [{ family: 'Anderson', given: ['Alice'], use: 'official' }],
    birthDate: '1985-03-15',
    gender: 'female' as const,
    active: true,
    telecom: [{ system: 'phone' as const, value: '+1-555-0101' }],
    address: [{ line: ['100 Sandbox Ln'], city: 'Springfield', state: 'IL', postalCode: '62701' }],
  },
  {
    id: 'sandbox-patient-002',
    identifier: [{ system: 'http://pixelated.com/mrn', value: 'SANDBOX-MRN-002' }],
    name: [{ family: 'Baker', given: ['Bob'], use: 'official' }],
    birthDate: '1972-07-22',
    gender: 'male' as const,
    active: true,
    telecom: [{ system: 'phone' as const, value: '+1-555-0102' }],
    address: [{ line: ['200 Test Ave'], city: 'Springfield', state: 'IL', postalCode: '62702' }],
  },
  {
    id: 'sandbox-patient-003',
    identifier: [{ system: 'http://pixelated.com/mrn', value: 'SANDBOX-MRN-003' }],
    name: [{ family: 'Chen', given: ['Carol'], use: 'official' }],
    birthDate: '1990-11-08',
    gender: 'female' as const,
    active: true,
    telecom: [{ system: 'email' as const, value: 'carol.sandbox@example.com' }],
    address: [{ line: ['300 Demo St'], city: 'Portland', state: 'OR', postalCode: '97201' }],
  },
  {
    id: 'sandbox-patient-004',
    identifier: [{ system: 'http://pixelated.com/mrn', value: 'SANDBOX-MRN-004' }],
    name: [{ family: 'Davis', given: ['David'], use: 'official' }],
    birthDate: '1965-04-30',
    gender: 'male' as const,
    active: true,
    telecom: [{ system: 'phone' as const, value: '+1-555-0104' }],
    address: [{ line: ['400 Sample Rd'], city: 'Austin', state: 'TX', postalCode: '73301' }],
  },
  {
    id: 'sandbox-patient-005',
    identifier: [{ system: 'http://pixelated.com/mrn', value: 'SANDBOX-MRN-005' }],
    name: [{ family: 'Evans', given: ['Eve'], use: 'official' }],
    birthDate: '1998-09-14',
    gender: 'female' as const,
    active: true,
    telecom: [{ system: 'phone' as const, value: '+1-555-0105' }],
    address: [{ line: ['500 Example Blvd'], city: 'Denver', state: 'CO', postalCode: '80201' }],
  },
];

/**
 * Synthetic encounters (2 per patient = 10 total).
 * Mix of statuses and encounter classes.
 */
function buildSyntheticEncounters(): Array<Record<string, unknown>> {
  const encounters: Array<Record<string, unknown>> = [];
  const statuses = ['finished', 'finished', 'in-progress', 'finished', 'finished'] as const;
  const classes = [
    { code: 'AMB', display: 'ambulatory' },
    { code: 'AMB', display: 'ambulatory' },
    { code: 'HH', display: 'home health' },
    { code: 'AMB', display: 'ambulatory' },
    { code: 'IMP', display: 'inpatient' },
  ];

  for (let i = 0; i < SYNTHETIC_PATIENTS.length; i++) {
    const patient = SYNTHETIC_PATIENTS[i];
    const patientIdx = i + 1;

    // Encounter 1: past visit
    encounters.push({
      resourceType: 'Encounter',
      id: `sandbox-encounter-${String(patientIdx * 2 - 1).padStart(3, '0')}`,
      status: statuses[i],
      class: classes[i],
      subject: { reference: `Patient/${patient.id}` },
      period: {
        start: `2024-0${(i % 9) + 1}-1${i}T09:00:00Z`,
        end: i < 4 ? `2024-0${(i % 9) + 1}-1${i}T10:00:00Z` : undefined,
      },
      reasonCode: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '185349003',
              display: i === 4 ? 'Encounter for check-up' : 'Encounter for symptom',
            },
          ],
        },
      ],
    });

    // Encounter 2: follow-up
    encounters.push({
      resourceType: 'Encounter',
      id: `sandbox-encounter-${String(patientIdx * 2).padStart(3, '0')}`,
      status: i === 2 ? 'planned' : 'finished',
      class: { code: 'AMB', display: 'ambulatory' },
      subject: { reference: `Patient/${patient.id}` },
      period: {
        start: `2024-0${((i + 3) % 9) + 1}-2${i}T14:00:00Z`,
        end: i === 2 ? undefined : `2024-0${((i + 3) % 9) + 1}-2${i}T15:00:00Z`,
      },
      reasonCode: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '185349003',
              display: 'Encounter for check-up (follow-up)',
            },
          ],
        },
      ],
    });
  }

  return encounters;
}

/**
 * Synthetic observations (3 per patient = 15 total).
 * Blood pressure, heart rate, and body temperature.
 */
function buildSyntheticObservations(): Array<Record<string, unknown>> {
  const observations: Array<Record<string, unknown>> = [];
  let obsIdx = 0;

  for (let i = 0; i < SYNTHETIC_PATIENTS.length; i++) {
    const patient = SYNTHETIC_PATIENTS[i];
    const encounterId = `sandbox-encounter-${String((i + 1) * 2 - 1).padStart(3, '0')}`;

    // Blood pressure (panel)
    obsIdx++;
    observations.push({
      resourceType: 'Observation',
      id: `sandbox-observation-${String(obsIdx).padStart(3, '0')}`,
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel',
          },
        ],
      },
      subject: { reference: `Patient/${patient.id}` },
      encounter: { reference: `Encounter/${encounterId}` },
      effectiveDateTime: `2024-0${(i % 9) + 1}-1${i}T09:15:00Z`,
      component: [
        {
          code: {
            coding: [
              { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
            ],
          },
          valueQuantity: { value: 110 + i * 4, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
        },
        {
          code: {
            coding: [
              { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
            ],
          },
          valueQuantity: { value: 70 + i * 3, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
        },
      ],
    });

    // Heart rate
    obsIdx++;
    observations.push({
      resourceType: 'Observation',
      id: `sandbox-observation-${String(obsIdx).padStart(3, '0')}`,
      status: 'final',
      code: {
        coding: [
          { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
        ],
      },
      subject: { reference: `Patient/${patient.id}` },
      encounter: { reference: `Encounter/${encounterId}` },
      effectiveDateTime: `2024-0${(i % 9) + 1}-1${i}T09:20:00Z`,
      valueQuantity: { value: 68 + i * 2, unit: 'beats/minute', system: 'http://unitsofmeasure.org', code: '/min' },
    });

    // Body temperature
    obsIdx++;
    observations.push({
      resourceType: 'Observation',
      id: `sandbox-observation-${String(obsIdx).padStart(3, '0')}`,
      status: 'final',
      code: {
        coding: [
          { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
        ],
      },
      subject: { reference: `Patient/${patient.id}` },
      encounter: { reference: `Encounter/${encounterId}` },
      effectiveDateTime: `2024-0${(i % 9) + 1}-1${i}T09:25:00Z`,
      valueQuantity: { value: 36.5 + i * 0.2, unit: 'degrees Celsius', system: 'http://unitsofmeasure.org', code: 'Cel' },
    });
  }

  return observations;
}

// ─── Seed Function ─────────────────────────────────────

/**
 * Seeds a sandbox tenant with synthetic test data.
 *
 * @param options - Tenant ID and optional reset flag
 * @returns Summary of created resources
 *
 * @example
 * ```typescript
 * const result = await seedSandboxTenant({ tenantId: 'sandbox-001' });
 * console.log(`Created ${result.patientsCreated} patients, ${result.encountersCreated} encounters`);
 * ```
 */
export async function seedSandboxTenant(options: SandboxSeedOptions): Promise<SandboxSeedResult> {
  const { tenantId, reset = false } = options;

  const result: SandboxSeedResult = {
    tenantId,
    patientsCreated: 0,
    encountersCreated: 0,
    observationsCreated: 0,
    patientIds: [],
    encounterIds: [],
    observationIds: [],
  };

  // System-level RLS context for seeding (uses service role)
  const rlsContext: RLSContext = {
    tenantId,
    userId: 'system-sandbox-seeder',
    role: 'system',
  };

  await transaction(async (client) => {
    // Optionally clear existing sandbox data
    if (reset) {
      await client.query(
        `DELETE FROM ehr_resources WHERE tenant_id = $1 AND id LIKE 'sandbox-%'`,
        [tenantId],
      );
    }

    const patientRepo = new PatientRepository(rlsContext);
    const encounterRepo = new EncounterRepository(rlsContext);
    const observationRepo = new ObservationRepository(rlsContext);

    // Seed patients
    for (const patientData of SYNTHETIC_PATIENTS) {
      await patientRepo.create({ ...patientData, resourceType: 'Patient' });
      result.patientIds.push(patientData.id);
      result.patientsCreated++;
    }

    // Seed encounters
    const encounters = buildSyntheticEncounters();
    for (const encounterData of encounters) {
      await encounterRepo.create(encounterData);
      result.encounterIds.push(String(encounterData.id));
      result.encountersCreated++;
    }

    // Seed observations
    const observations = buildSyntheticObservations();
    for (const observationData of observations) {
      await observationRepo.create(observationData);
      result.observationIds.push(String(observationData.id));
      result.observationsCreated++;
    }
  });

  return result;
}

/**
 * Clears all sandbox data for a tenant.
 * Only removes resources with 'sandbox-' ID prefix.
 */
export async function clearSandboxData(tenantId: string): Promise<number> {
  const rlsContext: RLSContext = {
    tenantId,
    userId: 'system-sandbox-clearer',
    role: 'system',
  };

  let deleted = 0;
  await transaction(async (client) => {
    const res = await client.query(
      `DELETE FROM ehr_resources WHERE tenant_id = $1 AND id LIKE 'sandbox-%' RETURNING id`,
      [tenantId],
    );
    deleted = res.rowCount ?? 0;
  });

  return deleted;
}

/**
 * Checks if a tenant has sandbox data seeded.
 */
export async function isSandboxSeeded(tenantId: string): Promise<boolean> {
  let exists = false;
  await transaction(async (client) => {
    const res = await client.query(
      `SELECT EXISTS(SELECT 1 FROM ehr_resources WHERE tenant_id = $1 AND id LIKE 'sandbox-%' LIMIT 1)`,
      [tenantId],
    );
    exists = Boolean(res.rows[0]?.exists);
  });
  return exists;
}

// ─── CLI Entry Point ───────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const tenantIdx = args.indexOf('--tenant');
  const resetIdx = args.indexOf('--reset');

  if (tenantIdx === -1 || !args[tenantIdx + 1]) {
    console.error('Usage: sandbox-seed.ts --tenant <tenant-id> [--reset]');
    process.exit(1);
  }

  const tenantId = args[tenantIdx + 1];
  const reset = resetIdx !== -1;

  console.log(`[sandbox-seed] Seeding tenant: ${tenantId}${reset ? ' (reset mode)' : ''}`);

  try {
    const result = await seedSandboxTenant({ tenantId, reset });
    console.log('[sandbox-seed] Complete:', {
      patientsCreated: result.patientsCreated,
      encountersCreated: result.encountersCreated,
      observationsCreated: result.observationsCreated,
    });
    console.log('[sandbox-seed] Patient IDs:', result.patientIds.join(', '));
    console.log('[sandbox-seed] Encounter IDs:', result.encounterIds.join(', '));
    console.log('[sandbox-seed] Observation IDs:', result.observationIds.join(', '));
  } catch (err) {
    console.error('[sandbox-seed] FAILED:', err);
    process.exit(1);
  }
}

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
