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

predicate isFHIRClientInit(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%FHIRClient%") or
      name.matches("%createClient%")
    )
  )
}

from CallExpr clientInit
where
  isFHIRClientInit(clientInit) and
  exists(CallExpr versionCheck |
    (versionCheck.getCalleeName().matches("%version%") or
     versionCheck.getCalleeName().matches("%compatibility%") or
     versionCheck.getCalleeName().matches("%checkVersion%")) and
    clientInit.getAChildCallExpr() = versionCheck
  )
select clientInit,
  "FHIR client initialization without version check detected. Ensure version compatibility."