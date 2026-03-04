/**
 * @name FHIR Security Checks - Unvalidated Access
 * @description Detects FHIR resource access without proper validation
 * @kind problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision high
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
      name.matches("%getResource%") or
      name.matches("%searchResource%") or
      name.matches("%createResource%") or
      name.matches("%updateResource%") or
      name.matches("%read%") or
      name.matches("%vread%") or
      name.matches("%search%")
    )
  )
}

predicate hasValidation(CallExpr call) {
  exists(CallExpr validateCall |
    (
      validateCall.getCalleeName().matches("%validate%") or
      validateCall.getCalleeName().matches("%check%") or
      validateCall.getCalleeName().matches("%verify%")
    ) and
    (
      validateCall.getAnArgument() = call.getAnArgument() or
      DataFlow::localFlow(DataFlow::exprNode(call), DataFlow::exprNode(validateCall.getAnArgument()))
    )
  )
}

from CallExpr resourceCall
where
  isFHIRResourceAccess(resourceCall) and
  not hasValidation(resourceCall)
select resourceCall,
  "FHIR resource access without validation detected. Ensure proper validation before access."
