/**
 * @name Unvalidated FHIR Resource Access
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

/**
 * Checks whether a given call to a FHIR resource access method lacks a
 * corresponding validation call within the same enclosing function.
 *
 * @param call The call expression representing the FHIR resource access.
 * @return true if a validation call exists in the same function.
 */
predicate hasValidation(CallExpr call) {
  // Look for a validation call defined in the same function as `call`.
  exists(CallExpr validateCall |
    validateCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (validateCall.getCalleeName().matches("%validate%") or
     validateCall.getCalleeName().matches("%check%") or
     validateCall.getCalleeName().matches("%verify%"))
  )
}

from CallExpr resourceCall
where
  isFHIRResourceAccess(resourceCall) and
  not hasValidation(resourceCall)
select resourceCall,
  "FHIR resource access without validation detected. Ensure proper validation before access."