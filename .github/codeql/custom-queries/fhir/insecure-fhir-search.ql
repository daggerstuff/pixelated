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
import dataflow

/**
 * Returns true if the call is a FHIR search operation that is likely part of a
 * FHIR client/resource (i.e., the callee is defined in a class whose name
 * contains “FHIR” or “Resource”).
 */
predicate isFHIRSearch(CallExpr call) {
  // The callee must be a method whose name ends with a known FHIR search verb
  exists(Function callee |
    callee = call.getCallee() and
    (
      callee.getName().matches("(?i)search$") or
      callee.getName().matches("(?i)find$") or
      callee.getName().matches("(?i)query$") or
      callee.getName().matches("(?i)bundleSearch$")
    ) and
    // The declaring class name indicates a FHIR client or resource
    callee.getDeclaringClass().getName().matches("(?i).*(FHIR|Resource)")
  )
}

/**
 * Checks whether the call receives sanitized/validated input.
 *
 * A search call is considered sanitized only if a sanitization function
 * (e.g., sanitize, escape, validate) data‑flows into one of its arguments.
 * This prevents unrelated sanitization in the same function from falsely
 * marking the search as safe.
 */
predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    sanitizeCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (
      sanitizeCall.getCalleeName().matches("%sanitize%") or
      sanitizeCall.getCalleeName().matches("%escape%") or
      sanitizeCall.getCalleeName().matches("%validate%")
    ) and
    // The sanitization must data‑flow into at least one argument of the search call
    exists(i : int |
      i < call.getArgumentCount() and
      dataFlows(sanitizeCall, call.getArgument(i))
    )
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."