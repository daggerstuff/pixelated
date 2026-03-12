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
 * Helper predicate to determine whether a call occurs within a FHIR‑related context.
 * This can be indicated by:
 *   - The enclosing class name containing "FHIR" (case‑insensitive), or
 *   - The declaring file path containing a "fhir" directory.
 */
predicate isFHIRContext(CallExpr call) {
  // Check enclosing class name for "FHIR"
  exists(string clsName |
    clsName = call.getEnclosingClass().getName() and
    clsName.matches("(?i).*FHIR.*")
  ) or
  // Check file path for a "fhir" directory
  exists(string path |
    path = call.getFile().getPath() and
    path.matches("(?i).*/fhir/.*")
  )
}

/**
 * Detects FHIR search operations based on method name patterns.
 * Now also requires the call to be in a FHIR context to avoid false positives.
 */
predicate isFHIRSearch(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("(?i)%search%") or
      name.matches("(?i)%find%") or
      name.matches("(?i)%query%")
    )
  ) and
  isFHIRContext(call)
}

predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    (
      sanitizeCall.getCalleeName().matches("%sanitize%") or
      sanitizeCall.getCalleeName().matches("%escape%") or
      sanitizeCall.getCalleeName().matches("%validate%")
    ) and
    DataFlow::localFlow(DataFlow::exprNode(sanitizeCall), DataFlow::exprNode(call.getAnArgument())) and
    sanitizeCall.getEnclosingScope() == call.getEnclosingScope()
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."