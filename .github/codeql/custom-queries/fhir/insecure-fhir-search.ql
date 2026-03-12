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
 * Predicate that identifies FHIR search operations (e.g., search, find, query, bundle-search)
 * that are invoked without proper input sanitization.
 */
predicate isFHIRSearch(CallExpr call) {
  // Resolve the callee to a Function object
  exists(Function callee |
    callee = call.getResolvedCallee() and
    callee.getName().regexpMatch("(?i)search$") or
    callee.getName().regexpMatch("(?i)find$") or
    callee.getName().regexpMatch("(?i)query$") or
    callee.getName().regexpMatch("(?i)bundleSearch$")
  )
}

/**
 * Predicate that checks whether a call to a FHIR search operation is sanitized.
 * Looks for sanitizing functions such as sanitize, escape, or validate.
 */
predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    sanitizeCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (
      sanitizeCall.getResolvedCallee().getName().regexpMatch("(?i)sanitize$") or
      sanitizeCall.getResolvedCallee().getName().regexpMatch("(?i)escape$")
    )
    and
    // The sanitization must data‑flow into at least one argument of the search call
    exists(i : int |
      i < call.getArgumentCount() and
      dataFlows(sanitizeCall, call.getArgument(i))
    )
  )
}

/** Main query: select all insecure FHIR search calls lacking sanitization. */
from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."