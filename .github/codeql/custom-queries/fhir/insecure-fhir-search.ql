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
 * Determines if the call is within a FHIR-related context.
 */
predicate isFHIRContext(CallExpr call) {
  exists(string clsName |
    clsName = call.getEnclosingClass().getName() and
    clsName.regexpMatch("(?i).*FHIR.*")
  ) or
  exists(string path |
    path = call.getFile().getPath() and
    path.regexpMatch("(?i).*/fhir/.*")
  )
}

predicate isFHIRSearch(CallExpr call) {
  // FHIR-specific context filter: class name contains "FHIR" or file path contains "/fhir/"
  exists(string clsName |
    clsName = call.getEnclosingClass().getName() and
    clsName.regexpMatch("(?i).*FHIR.*")
  ) or
  exists(string path |
    path = call.getFile().getPath() and
    path.regexpMatch("(?i).*/fhir/.*")
  )
  and
  exists(string name |
    name = call.getCalleeName() and
    (
      name.regexpMatch("(?i).*search.*") or
      name.regexpMatch("(?i).*find.*") or
      name.regexpMatch("(?i).*query.*")
    )
  )
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