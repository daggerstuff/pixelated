import javascript

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
  not exists(CallExpr mfaCall |
    (
      mfaCall.getCalleeName().matches("%mfa%") or
      mfaCall.getCalleeName().matches("%2fa%") or
      mfaCall.getCalleeName().matches("%verifyToken%") or
      mfaCall.getCalleeName().matches("%verifyOtp%") or
      mfaCall.getCalleeName().matches("%twoFactor%")
    ) and
    mfaCall.getEnclosingFunction() = authCall.getEnclosingFunction()
  )
select authCall,
  "Potential insecure EHR authentication detected. HIPAA compliance requires strong authentication."