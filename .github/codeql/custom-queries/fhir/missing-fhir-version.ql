/**
 * @name Missing FHIR Version Check
 * @kind problem
 * @id js/missing-fhir-version
 * @tags security hipaa fhir
 */
import javascript
from CallExpr clientInit
where exists(string name | name = clientInit.getCalleeName() and (name.matches("%Client%") or name.matches("%FHIRClient%") or name.matches("%createClient%")))
  and not exists(CallExpr v | v.getCalleeName().matches("%version%") or v.getCalleeName().matches("%compatibility%") or v.getCalleeName().matches("%checkVersion%"))
select clientInit, "FHIR client initialization without version check detected."
