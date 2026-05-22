import { PersistentTurnLedger } from './persistent-store'

let ledgerInstance: PersistentTurnLedger | null = null

export function getLedger(): PersistentTurnLedger {
  ledgerInstance ??= new PersistentTurnLedger()
  return ledgerInstance
}
