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

predicate isFHIROperation(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%batch%") or
      name.matches("%transaction%") or
      name.matches("%history%") or
      name.matches("%delete%") or
      name.matches("%patch%")
    )
  )
}

predicate hasSecurityContext(CallExpr call) {
  exists(CallExpr securityCall |
    (
      securityCall.getCalleeName().matches("%authorize%") or
      securityCall.getCalleeName().matches("%checkPermission%") or
      securityCall.getCalleeName().matches("%verifyAccess%")
    ) and
    (
      securityCall.getAnArgument().flowsTo(call.getAnArgument()) or
      call.getAnArgument().flowsTo(securityCall.getAnArgument()) or
      exists(Expr e | securityCall.getAnArgument() = e and call.getAnArgument() = e)
    )
  )
}

from CallExpr fhirOp
where
  isFHIROperation(fhirOp) and
  not hasSecurityContext(fhirOp)
select fhirOp,
  "FHIR operation without security context detected. Ensure proper authorization."
