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
 * Checks whether the given call is a FHIR search operation.
 * We narrow the match to calls whose qualified name contains "fhir"
 * and one of the search-related suffixes, reducing false positives
 * from generic Array.find() or document.querySelector() calls.
 */
predicate isFHIRSearch(CallExpr call) {
  exists(string qname |
    qname = call.getCallee().getQualifiedName() and
    (
      qname.matches("%fhir%search%") or
      qname.matches("%fhir%find%") or
      qname.matches("%fhir%query%")
    )
  )
}

/**
 * Checks whether the given search operation has input sanitization.
 * Uses data‑flow to ensure that at least one argument of the search call
 * flows to a call whose name matches sanitize/escape/validate patterns.
 */
predicate hasInputSanitization(CallExpr searchCall) {
  exists(CallExpr sanitizeCall, DataFlow::Node arg |
    (
      sanitizeCall.getCalleeName().matches("%sanitize%") or
      sanitizeCall.getCalleeName().matches("%escape%") or
      sanitizeCall.getCalleeName().matches("%validate%")
    ) and
    arg = DataFlow::exprNode(searchCall.getAnArgument()) and
    DataFlow::localFlow(DataFlow::exprNode(sanitizeCall), arg)
  )
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."