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
 * Checks whether a FHIR search operation uses a callee name that indicates a search
 * and is performed within a FHIR context (e.g., a class related to FHIR resources).
 */
predicate isFHIRSearch(CallExpr call) {
  // Ensure the call originates from a class that suggests a FHIR context.
  exists(Class cls |
    cls = call.getDeclaringClass() and
    (cls.hasName("%FHIR%") or
     cls.hasName("%Search%") or
     cls.hasName("%Find%") or
     cls.hasName("%Query%"))
  ) and
  // Then verify that the callee name looks like a FHIR search operation.
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
 * Checks whether the given call performs input sanitization (e.g., sanitize, escape, validate).
 * The check is now directly tied to the call itself, not to any unrelated call.
 */
predicate hasSanitization(CallExpr call) {
  call.getCalleeName().matches("%sanitize%") or
  call.getCalleeName().matches("%escape%") or
  call.getCalleeName().matches("%validate%")
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."