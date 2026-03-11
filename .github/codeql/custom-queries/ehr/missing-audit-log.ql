/**
 * @name Missing Audit Logging
 * @kind problem
 * @id js/missing-audit-log
 * @tags security hipaa audit
 */
import javascript
from CallExpr ehrOp
where exists(string name | name = ehrOp.getCalleeName() and (name.matches("%patient%") or name.matches("%record%") or name.matches("%ehr%") or name.matches("%fhir%")))
  and not exists(CallExpr l | l.getCalleeName().matches("%log%") or l.getCalleeName().matches("%audit%"))
select ehrOp, "EHR operation detected without audit logging."
