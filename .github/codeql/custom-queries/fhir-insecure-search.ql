/**
 * @name Insecure FHIR Search
 * @description Detects potentially insecure FHIR search operations
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

predicate isFHIRSearch(CallExpr searchOp) {
  exists(string name |
    name = searchOp.getCalleeName() and
    (
      name.matches("%search%") or
      name.matches("%find%") or
      name.matches("%query%")
    )
  )
}

predicate hasLocalInputSanitization(CallExpr searchOp) {
  exists(CallExpr sanitizeCall |
    (
      sanitizeCall.getCalleeName().matches("%sanitize%") or
      sanitizeCall.getCalleeName().matches("%escape%") or
      sanitizeCall.getCalleeName().matches("%validate%")
    ) and
    sanitizeCall.getEnclosingFunction() = searchOp.getEnclosingFunction()
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasLocalInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without local input sanitization detected. Ensure proper input validation."
