/**
 * @name Missing FHIR Version Check
 * @description Detects FHIR operations without version compatibility checks
 * @kind problem
 * @problem.severity warning
 * @security-severity 5.0
 * @precision high
 * @id js/missing-fhir-version
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

/**
 * Checks whether a FHIR client initialization call has a version compatibility check
 * within the same enclosing function or method.
 *
 * @param clientInit the call that initializes a FHIR client
 * @return true if a version check call exists in the same function
 */
predicate hasVersionCheck(CallExpr clientInit) {
  exists(CallExpr versionCall |
    versionCall.getEnclosingFunction() = clientInit.getEnclosingFunction() and
    (
      versionCall.getCalleeName().matches("%version%") or
      versionCall.getCalleeName().matches("%compatibility%") or
      versionCall.getCalleeName().matches("%checkVersion%")
    )
  )
}

predicate isFHIRClientInit(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%FHIRClient%") or
      name.matches("%FhirClient%") or
      name.matches("%createFHIRClient%")
    )
  )
}

from CallExpr clientInit
where
  isFHIRClientInit(clientInit) and
  not hasVersionCheck(clientInit)
select clientInit,
  "FHIR client initialization without version check detected. Ensure version compatibility."