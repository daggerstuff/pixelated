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
      name.matches("%Client%") or
      name.matches("%FHIRClient%") or
      name.matches("%createClient%")
    )
  )
}

predicate hasVersionCheck(CallExpr call) {
  exists(CallExpr versionCall |
    (
      versionCall.getCalleeName().matches("%version%") or
      versionCall.getCalleeName().matches("%compatibility%") or
      versionCall.getCalleeName().matches("%checkVersion%")
    ) and
    (
      versionCall.getAnArgument().flowsTo(call.getAnArgument()) or
      call.getAnArgument().flowsTo(versionCall.getAnArgument()) or
      exists(Expr e | versionCall.getAnArgument() = e and call.getAnArgument() = e)
    )
  )
}

from CallExpr clientInit
where
  isFHIRClientInit(clientInit) and
  not hasVersionCheck(clientInit)
select clientInit,
  "FHIR client initialization without version check detected. Ensure version compatibility."
