/**
 * @name Insecure EHR Authentication
 * @description Detects weak authentication methods for EHR access
 * @kind problem
 * @problem.severity error
 * @security-severity 8.0
 * @precision high
 * @id js/insecure-ehr-auth
 * @tags security
 *       hipaa
 *       authentication
 */

import javascript

predicate isAuthenticationMethod(CallExpr authCall) {
  exists(string name |
    name = authCall.getCalleeName() and
    (
      name.matches("%login%") or
      name.matches("%authenticate%") or
      name.matches("%auth%")
    )
  )
}

predicate hasLocalStrongAuth(CallExpr authCall) {
  exists(CallExpr mfaCall |
    (
      mfaCall.getCalleeName().matches("%mfa%") or
      mfaCall.getCalleeName().matches("%2fa%") or
      mfaCall.getCalleeName().matches("%verify%")
    ) and
    mfaCall.getEnclosingFunction() = authCall.getEnclosingFunction()
  )
}

from CallExpr authCall
where
  isAuthenticationMethod(authCall) and
  not hasLocalStrongAuth(authCall)
select authCall,
  "Potential insecure EHR authentication detected. HIPAA compliance requires strong authentication."
