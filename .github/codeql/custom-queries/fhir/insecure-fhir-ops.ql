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
    // Match whole‑word FHIR operation names (batch, transaction, history, delete, patch)
    name.matches("(?i)\\b(batch|transaction|history|delete|patch)\\b")
  ) and
  // Require the callee to be in a FHIR‑related namespace/type
  call.getTarget().getName().matches("(?i).*(fhir|FHIR|hl7)")
}

predicate hasSecurityContext(CallExpr call) {
  exists(CallExpr securityCall |
    securityCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (
      securityCall.getCalleeName().matches("%authorize%") or
      securityCall.getCalleeName().matches("%checkPermission%") or
      securityCall.getCalleeName().matches("%verifyAccess%")
    )
  )
}

from CallExpr fhirOp
where
  isFHIROperation(fhirOp) and
  not hasSecurityContext(fhirOp)
select fhirOp,
  "FHIR operation without security context detected. Ensure proper authorization."