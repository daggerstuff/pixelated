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

/**
 * Checks whether the call is made in an EHR‑related context.
 * We consider a context EHR‑specific if the call is inside a class
 * whose name contains “ehr” (case‑insensitive) or if the call is
 * inside a module import that contains “ehr”.
 */
predicate isEHRContext(CallExpr call) {
  // 1. Inside a class named like *ehr* (e.g., EHRUser, ehrService)
  exists(ClassDecl cls |
    cls.getName().matches("(?i).*ehr.*") and
    cls.getAChild() = call
  )
  or
  // 2. Inside a module import that mentions “ehr”
  exists(ImportStmt imp |
    imp.getModuleName().matches("(?i).*ehr.*") and
    call.getEnclosingModule() = imp.getModule()
  )
}

predicate isAuthenticationMethod(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%login%") or
      name.matches("%authenticate%") or
      name.matches("%auth%")
    )
  )
}

from CallExpr authCall
where
  isAuthenticationMethod(authCall) and
  isEHRContext(authCall) and
  not exists(CallExpr mfaCall |
    mfaCall.getEnclosingFunction() = authCall.getEnclosingFunction() and
    (
      mfaCall.getCalleeName().matches("%mfa%") or
      mfaCall.getCalleeName().matches("%2fa%") or
      mfaCall.getCalleeName().matches("%verify%")
    )
  )
select authCall,
  "Potential insecure EHR authentication detected. HIPAA compliance requires strong authentication."