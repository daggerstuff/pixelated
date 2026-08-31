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
 * Identifies expressions that represent HTTP client objects based on
 * variable naming conventions common in EHR modules. Combined with the
 * EHR file restriction and the method-name check, this precisely targets
 * network transmission calls and avoids false positives from non-HTTP
 * objects (Map.get, redisClient.get, etc.).
 */
predicate isHttpClientReceiver(Expr receiver) {
  receiver.(VarRef).getName().matches("%axios%") or
  receiver.(VarRef).getName().matches("%request%") or
  receiver.(VarRef).getName().matches("%http%") or
  receiver.(VarRef).getName().matches("%api%") or
  receiver.(VarRef).getName().matches("%fetch%")
}

/**
 * Matches actual network transmission calls within EHR modules.
 * Handles direct function invocations (fetch, axios, request) and
 * member-method invocations on HTTP client objects (axios.post, api.get,
 * etc.). Member calls are restricted to HTTP client receivers via
 * isHttpClientReceiver to prevent false positives from non-HTTP objects.
 */
predicate isDataTransmissionCall(CallExpr call) {
  isEHRFile(call.getFile()) and
  (
    // Direct function calls: fetch(...), axios(...), request(...)
    call.getCallee().(VarRef).getName() = ["fetch", "axios", "request"]
    or
    // Member method calls on HTTP client objects: axios.post(...), etc.
    exists(PropAccess pa |
      call.getCallee() = pa and
      pa.getPropertyName() = ["post", "get", "put", "patch", "delete"] and
      isHttpClientReceiver(pa.getBase())
    )
  )
}

/**
 * Matches EHR-sensitive data sources within EHR modules.
 * Uses specific clinical/FHIR data type names rather than
 * common English words like "health" or "record" that appear
 * in non-EHR files (dream-worker.ts, ResistanceMonitor.tsx, etc.).
 * Handles both expression nodes and function parameter nodes: a parameter
 * has no underlying expression to stringify, so its EHR classification
 * must come from the parameter's own name and file.
 */
predicate isEHRData(DataFlow::Node node) {
  exists(string name |
    (
      isEHRFile(node.asExpr().getFile()) and
      name = node.asExpr().toString().toLowerCase()
      or
      exists(Parameter p |
        node = DataFlow::parameterNode(p) and
        isEHRFile(p.getFile()) and
        name = p.getName().toLowerCase()
      )
    ) and
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
 * Checks whether `src` data is encrypted before flowing into `sinkArg` —
 * the specific argument of the transmission call that the source reaches.
 * Binding the source, the encryption result, and the sink to the SAME
 * argument prevents an unrelated encrypted argument from suppressing an
 * alert for EHR data flowing through a different argument.
 */
predicate isEncryptedBeforeCall(DataFlow::Node src, DataFlow::Node sinkArg) {
  exists(CallExpr encryptCall |
    encryptCall.getCalleeName().matches("%encrypt%") and
    src.getASuccessor*() = DataFlow::exprNode(encryptCall.getAnArgument()) and
    DataFlow::exprNode(encryptCall).getASuccessor*() = sinkArg
  )
}

from DataFlow::Node src, DataFlow::Node sinkArg, CallExpr call
where
  isDataTransmissionCall(call) and
  sinkArg = DataFlow::exprNode(call.getAnArgument()) and
  isEHRData(src) and
  // Real data flow: EHR data must actually flow into the call's argument
  src.getASuccessor*() = sinkArg and
  // Encryption must be LOCAL to this data flow path
  not isEncryptedBeforeCall(src, sinkArg)
select call,
  "Potential unencrypted EHR data transmission detected. HIPAA requires encryption of PHI in transit."
