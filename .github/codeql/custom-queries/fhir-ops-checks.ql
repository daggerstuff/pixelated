/**
 * @name Insecure FHIR Operations or Missing Version Checks
 * @description Detects potentially insecure FHIR operations or missing version checks
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.5
 * @precision high
 * @id js/insecure-fhir-checks
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

from CallExpr call
where
  (
    (call.getCalleeName().matches("%Client%") or call.getCalleeName().matches("%FHIRClient%")) and
    not exists(CallExpr v | v.getCalleeName().matches("%version%"))
  ) or
  (
    call.getCalleeName().matches("%batch%") and
    not exists(CallExpr s | s.getCalleeName().matches("%authorize%") or s.getCalleeName().matches("%check%"))
  )
select call, "Potential FHIR security check missing (version check or authorization)."
