/**
 * @name FHIR Security and Validation Checks
 * @description Detects FHIR resource access without proper validation or security context
 * @kind problem
 * @problem.severity warning
 * @security-severity 8.5
 * @precision high
 * @id js/fhir-security-checks
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

predicate isFHIRResourceAccess(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%getResource%") or
      name.matches("%searchResource%") or
      name.matches("%createResource%") or
      name.matches("%updateResource%") or
      name.matches("%read%") or
      name.matches("%vread%") or
      name.matches("%search%") or
      name.matches("%batch%") or
      name.matches("%transaction%") or
      name.matches("%history%") or
      name.matches("%delete%") or
      name.matches("%patch%")
    )
  )
}

predicate hasValidationOrSecurity(CallExpr call) {
  exists(CallExpr c |
    c.getCalleeName().matches("%validate%") or
    c.getCalleeName().matches("%check%") or
    c.getCalleeName().matches("%verify%") or
    c.getCalleeName().matches("%authorize%") or
    c.getCalleeName().matches("%checkPermission%") or
    c.getCalleeName().matches("%verifyAccess%")
  )
}

from CallExpr resourceCall
where
  isFHIRResourceAccess(resourceCall) and
  not hasValidationOrSecurity(resourceCall)
select resourceCall,
  "FHIR operation without proper validation or security context detected."
