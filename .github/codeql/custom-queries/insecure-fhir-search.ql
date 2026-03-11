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

/**
 * Determines whether a call is a FHIR search operation.
 */
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

/**
 * Determines whether the input to a FHIR search operation has been sanitized.
 * This predicate looks for a preceding call to a sanitization function
 * (e.g., sanitize, escape, validate) that operates on the same argument
 * supplied to the search call.
 */
predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    sanitizeCall.getParent() = call.getParent() and
    sanitizeCall.getStartLine() < call.getStartLine() and
    sanitizeCall.getArgument(0) = call.getArgument(0) and
    (sanitizeCall.getCalleeName().matches("%sanitize%") or
     sanitizeCall.getCalleeName().matches("%escape%") or
     sanitizeCall.getCalleeName().matches("%validate%"))
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."