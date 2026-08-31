/**
 * @name Unencrypted EHR Data Transfer
 * @description Detects EHR data flowing into network calls without encryption.
 *              Restricted to EHR module files to prevent false positives.
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/unencrypted-ehr-data
 * @tags security
 *       hipaa
 *       ehr
 */

import javascript

/**
 * Restricts analysis to EHR module files where patient/clinical data
 * is actually handled. This prevents false positives from unrelated
 * code that merely mentions health-related terms.
 */
predicate isEHRFile(File f) {
  f.getAbsolutePath().matches("%apps/web/src/lib/ehr-native/%") or
  f.getAbsolutePath().matches("%apps/web/src/lib/documentation/ehrIntegration%")
}

/**
 * Matches actual network transmission calls within EHR modules.
 * Only matches well-known network API names, not substring patterns
 * like "%http%" that match every HTTP-related call.
 */
predicate isDataTransmissionCall(CallExpr call) {
  isEHRFile(call.getFile()) and
  exists(string name |
    name = call.getCalleeName() and
    (
      name = "fetch" or
      name = "axios" or
      name = "request"
    )
  )
}

/**
 * Matches EHR-sensitive data sources within EHR modules.
 * Uses specific clinical/FHIR data type names rather than
 * common English words like "health" or "record" that appear
 * in non-EHR files (dream-worker.ts, ResistanceMonitor.tsx, etc.).
 */
predicate isEHRData(DataFlow::Node node) {
  isEHRFile(node.asExpr().getFile()) and
  exists(string name |
    name = node.asExpr().toString().toLowerCase() and
    (
      name.matches("%patient%") or
      name.matches("%clinical%") or
      name.matches("%sessiondocumentation%") or
      name.matches("%documentreference%") or
      name.matches("%composition%") or
      name.matches("%audit%")
    )
  )
}

/**
 * Checks whether `src` data is encrypted before flowing into `call`.
 * The encryption call must be on the data flow path from src to the
 * transmission call's argument — not just anywhere in the codebase.
 */
predicate isEncryptedBeforeCall(DataFlow::Node src, CallExpr call) {
  exists(CallExpr encryptCall |
    encryptCall.getCalleeName().matches("%encrypt%") and
    src.getASuccessor*() = DataFlow::exprNode(encryptCall.getAnArgument()) and
    DataFlow::exprNode(encryptCall).getASuccessor*() = DataFlow::exprNode(call.getAnArgument())
  )
}

from DataFlow::Node src, CallExpr call
where
  isDataTransmissionCall(call) and
  isEHRData(src) and
  // Real data flow: EHR data must actually flow into the call's argument
  src.getASuccessor*() = DataFlow::exprNode(call.getAnArgument()) and
  // Encryption must be LOCAL to this data flow path
  not isEncryptedBeforeCall(src, call)
select call,
  "Potential unencrypted EHR data transmission detected. HIPAA requires encryption of PHI in transit."
