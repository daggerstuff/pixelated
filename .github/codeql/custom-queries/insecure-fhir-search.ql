/**
 * @name Insecure FHIR Search
 * @description Detects potentially insecure FHIR search operations without input sanitization in the same function
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.5
 * @precision high
 * @id js/insecure-fhir-search
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

predicate isFHIRSearch(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%search%") or
      name.matches("%find%") or
      name.matches("%query%")
    )
  )
}

predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    sanitizeCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (
      sanitizeCall.getCalleeName().matches("%sanitize%") or
      sanitizeCall.getCalleeName().matches("%escape%") or
      sanitizeCall.getCalleeName().matches("%validate%")
    )
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization in the same function detected. Ensure proper input validation."
