/**
 * @name Unvalidated FHIR Resource Access
 * @kind problem
 * @id js/unvalidated-fhir-access
 * @tags security hipaa fhir
 */
import javascript
predicate isFHIRResourceAccess(CallExpr call) {
  exists(string name | name = call.getCalleeName() and
    (name.matches("%getResource%") or name.matches("%searchResource%") or name.matches("%createResource%") or
     name.matches("%updateResource%") or name.matches("%read%") or name.matches("%vread%") or name.matches("%search%")))
}
from CallExpr resourceCall
where isFHIRResourceAccess(resourceCall) and
  not exists(CallExpr v | v.getCalleeName().matches("%validate%") or v.getCalleeName().matches("%check%") or v.getCalleeName().matches("%verify%"))
select resourceCall, "FHIR resource access without validation detected."
