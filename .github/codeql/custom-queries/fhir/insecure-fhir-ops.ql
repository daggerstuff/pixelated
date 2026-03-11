/**
 * @name Insecure FHIR Operations
 * @kind problem
 * @id js/insecure-fhir-ops
 * @tags security hipaa fhir
 */
import javascript
from CallExpr fhirOp
where exists(string name | name = fhirOp.getCalleeName() and (name.matches("%batch%") or name.matches("%transaction%") or name.matches("%history%") or name.matches("%delete%") or name.matches("%patch%")))
  and not exists(CallExpr s | s.getCalleeName().matches("%authorize%") or s.getCalleeName().matches("%checkPermission%") or s.getCalleeName().matches("%verifyAccess%"))
select fhirOp, "FHIR operation without security context detected."
