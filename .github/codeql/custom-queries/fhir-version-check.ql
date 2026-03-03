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

predicate isFHIRClientInit(CallExpr clientInit) {
  exists(string name |
    name = clientInit.getCalleeName() and
    (
      name.matches("%Client%") or
      name.matches("%FHIRClient%") or
      name.matches("%createClient%")
    )
  )
}

predicate hasLocalVersionCheck(CallExpr clientInit) {
  exists(CallExpr versionCall |
    (
      versionCall.getCalleeName().matches("%version%") or
      versionCall.getCalleeName().matches("%compatibility%") or
      versionCall.getCalleeName().matches("%checkVersion%")
    ) and
    versionCall.getEnclosingFunction() = clientInit.getEnclosingFunction()
  )
}

from CallExpr clientInit
where
  isFHIRClientInit(clientInit) and
  not hasLocalVersionCheck(clientInit)
select clientInit,
  "FHIR client initialization without local version check detected. Ensure version compatibility."
