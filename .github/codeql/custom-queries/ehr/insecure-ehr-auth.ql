/**
 * @name Insecure EHR Authentication
 * @kind problem
 * @id js/insecure-ehr-auth
 * @tags security hipaa authentication
 */
import javascript
from CallExpr authCall
where exists(string name | name = authCall.getCalleeName() and (name.matches("%login%") or name.matches("%authenticate%") or name.matches("%auth%")))
  and not exists(CallExpr m | m.getCalleeName().matches("%mfa%") or m.getCalleeName().matches("%2fa%") or m.getCalleeName().matches("%verify%"))
select authCall, "Potential insecure EHR authentication detected."
