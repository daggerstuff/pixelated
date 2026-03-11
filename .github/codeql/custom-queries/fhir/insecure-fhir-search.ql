/**
 * @name Insecure FHIR Search
 * @kind problem
 * @id js/insecure-fhir-search
 * @tags security hipaa fhir
 */
import javascript
from CallExpr searchOp
where exists(string name | name = searchOp.getCalleeName() and (name.matches("%search%") or name.matches("%find%") or name.matches("%query%")))
  and not exists(CallExpr s | s.getCalleeName().matches("%sanitize%") or s.getCalleeName().matches("%escape%") or s.getCalleeName().matches("%validate%"))
select searchOp, "FHIR search operation without input sanitization detected."
