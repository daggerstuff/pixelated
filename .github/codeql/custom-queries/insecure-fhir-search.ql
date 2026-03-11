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
  call.getCalleeName().matches("%sanitize%") or
  call.getCalleeName().matches("%escape%") or
  call.getCalleeName().matches("%validate%")
}

from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."

// Ensure the call originates from a class that suggests a FHIR context.
exists(Class cls |
  cls = call.getDeclaringClass() and
  (cls.getName().matches("%FHIR%") or
   cls.getName().matches("%Search%") or
   cls.getName().matches("%Find%") or
   cls.getName().matches("%Query%"))