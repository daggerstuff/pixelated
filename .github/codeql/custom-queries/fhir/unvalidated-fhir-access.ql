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

predicate isFHIRResourceAccess(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      regexpMatch(name, "%getResource%") or
      regexpMatch(name, "%searchResource%") or
      regexpMatch(name, "%createResource%") or
      regexpMatch(name, "%updateResource%") or
      name.matches("%readResource%") or
      regexpMatch(name, "%vread%") or
      regexpMatch(name, "%search%")
    )
    // Guard against standard library functions that would otherwise be flagged
    and not regexpMatch(call.getTarget().getQualifiedName(), "%\\.(String|Object|Array|File)$")
  )
}

predicate hasValidation(CallExpr call) {
  exists(CallExpr validateCall |
    (validateCall.getCalleeName().matches("%validate%") or
     validateCall.getCalleeName().matches("%check%") or
     validateCall.getCalleeName().matches("%verify%")) and
    validateCall.getEnclosingFunction() = call.getEnclosingFunction()
  )
}

from CallExpr resourceCall
where
  isFHIRResourceAccess(resourceCall) and
  not hasValidation(resourceCall)
select resourceCall,
  "FHIR resource access without validation detected. Ensure proper validation before access."