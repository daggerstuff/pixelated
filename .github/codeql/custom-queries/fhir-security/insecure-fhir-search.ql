/**
 * @name Insecure FHIR Search
 * @description Detects FHIR search operations without input sanitization.
 *              Restricted to FHIR module files to prevent false positives.
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.5
 * @precision high
 * @id js/insecure-fhir-search
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

/**
 * Restricts analysis to FHIR/EHR module files where FHIR search
 * operations actually occur. This prevents false positives from
 * unrelated code using common method names like .find() or .search()
 * (dream-worker.ts, ResistanceMonitor.tsx, SlackNotificationService.ts, etc.).
 */
predicate isFHIRFile(File f) {
  f.getAbsolutePath().matches("%apps/web/src/lib/ehr-native/%") or
  f.getAbsolutePath().matches("%apps/web/src/lib/documentation/ehrIntegration%")
}

/**
 * Matches actual FHIR search operations within FHIR modules.
 * Targets the specific FHIR client method name "searchResources"
 * rather than generic substring patterns like "%search%" or "%find%"
 * that match every Array.find(), Array.filter(), or querySelector() call.
 */
predicate isFHIRSearch(CallExpr call) {
  isFHIRFile(call.getFile()) and
  call.getCalleeName() = "searchResources"
}

/**
 * Returns true if any argument passed to `call` has been through a
 * sanitization/validation/escaping call. The sanitized result must
 * flow into the search call's arguments via proper data flow.
 */
predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    (
      sanitizeCall.getCalleeName().matches("%sanitize%") or
      sanitizeCall.getCalleeName().matches("%escape%") or
      sanitizeCall.getCalleeName().matches("%validate%")
    ) and
    DataFlow::exprNode(sanitizeCall).getASuccessor*() = DataFlow::exprNode(call.getAnArgument())
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."
