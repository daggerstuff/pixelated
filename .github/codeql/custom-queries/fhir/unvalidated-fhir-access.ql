/**
 * @name Unvalidated FHIR Resource Access
 * @description Detects FHIR resource access without proper validation
 * @kind problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision medium
 * @id js/unvalidated-fhir-access
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

predicate isFHIRResourceAccess(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.regexpMatch(".*getResource.*") or
      name.regexpMatch(".*searchResource.*") or
      name.regexpMatch(".*createResource.*") or
      name.regexpMatch(".*updateResource.*") or
      name.regexpMatch(".*read.*") or
      name.regexpMatch(".*vread.*") or
      name.regexpMatch(".*search.*")
    )
  )
}

predicate hasValidation(CallExpr call) {
  exists(CallExpr validateCall |
    validateCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (
      validateCall.getCalleeName().regexpMatch(".*validate.*") or
      validateCall.getCalleeName().regexpMatch(".*check.*") or
      validateCall.getCalleeName().regexpMatch(".*verify.*")
    )
    and DataFlow::localFlow(DataFlow::exprNode(validateCall), DataFlow::exprNode(call))
  )
}

from CallExpr resourceCall
where
  isFHIRResourceAccess(resourceCall) and
  not hasValidation(resourceCall)
select resourceCall,
  "FHIR resource access without validation detected. Ensure proper validation before access."