/**
 * @name Unvalidated FHIR Resource Access
 * @description Detects FHIR resource access without proper validation
 * @kind problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision high
 * @id js/unvalidated-fhir-access
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

from CallExpr call
where
  (
    call.getCalleeName().matches("%getResource%") or
    call.getCalleeName().matches("%searchResource%") or
    call.getCalleeName().matches("%createResource%") or
    call.getCalleeName().matches("%updateResource%")
  ) and
  not exists(CallExpr check |
    check.getCalleeName().matches("%validate%") or
    check.getCalleeName().matches("%verify%")
  )
select call, "FHIR resource access without validation detected."
