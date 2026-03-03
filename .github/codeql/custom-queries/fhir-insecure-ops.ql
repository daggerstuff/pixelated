/**
 * @name Insecure FHIR Operations
 * @description Detects potentially insecure FHIR operations
 * @kind problem
 * @problem.severity warning
 * @security-severity 7.5
 * @precision high
 * @id js/insecure-fhir-ops
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

predicate isFHIROperation(CallExpr fhirOp) {
  exists(string name |
    name = fhirOp.getCalleeName() and
    (
      name.matches("%batch%") or
      name.matches("%transaction%") or
      name.matches("%history%") or
      name.matches("%delete%") or
      name.matches("%patch%")
    )
  )
}

predicate hasLocalSecurityContext(CallExpr fhirOp) {
  exists(CallExpr securityCall |
    (
      securityCall.getCalleeName().matches("%authorize%") or
      securityCall.getCalleeName().matches("%checkPermission%") or
      securityCall.getCalleeName().matches("%verifyAccess%")
    ) and
    securityCall.getEnclosingFunction() = fhirOp.getEnclosingFunction()
  )
}

from CallExpr fhirOp
where
  isFHIROperation(fhirOp) and
  not hasLocalSecurityContext(fhirOp)
select fhirOp,
  "FHIR operation without local security context detected. Ensure proper authorization."
