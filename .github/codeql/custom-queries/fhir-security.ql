/**
 * @name FHIR Security Pattern Detection
 * @description Detects common security issues in FHIR integrations
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/fhir-security
 * @tags security
 *       fhir
 *       hipaa
 */

import javascript

predicate isFHIRResourceAccess(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%getResource%") or
      name.matches("%searchResource%") or
      name.matches("%createResource%") or
      name.matches("%updateResource%") or
      name.matches("%read%") or
      name.matches("%vread%") or
      name.matches("%search%")
    )
  )
}

predicate hasValidation(CallExpr call) {
  exists(CallExpr validateCall |
    validateCall.getCalleeName().matches("%validate%") or
    validateCall.getCalleeName().matches("%check%") or
    validateCall.getCalleeName().matches("%verify%")
  )
}

predicate isFHIROperation(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%batch%") or
      name.matches("%transaction%") or
      name.matches("%history%") or
      name.matches("%delete%") or
      name.matches("%patch%")
    )
  )
}

predicate hasSecurityContext(CallExpr call) {
  exists(CallExpr securityCall |
    securityCall.getCalleeName().matches("%authorize%") or
    securityCall.getCalleeName().matches("%checkPermission%") or
    securityCall.getCalleeName().matches("%verifyAccess%")
  )
}

predicate isFHIRClientInit(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%Client%") or
      name.matches("%FHIRClient%") or
      name.matches("%createClient%")
    )
  )
}

predicate hasVersionCheck(CallExpr call) {
  exists(CallExpr versionCall |
    versionCall.getCalleeName().matches("%version%") or
    versionCall.getCalleeName().matches("%compatibility%") or
    versionCall.getCalleeName().matches("%checkVersion%")
  )
}

predicate isFHIRSearch(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%search%") or
      name.matches("%find%") or
      name.matches("%query%")
    )
  )
}

predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    sanitizeCall.getCalleeName().matches("%sanitize%") or
    sanitizeCall.getCalleeName().matches("%escape%") or
    sanitizeCall.getCalleeName().matches("%validate%")
  )
}

from CallExpr target, string message
where
  (isFHIRResourceAccess(target) and not hasValidation(target) and message = "FHIR resource access without validation detected. Ensure proper validation before access.")
  or
  (isFHIROperation(target) and not hasSecurityContext(target) and message = "FHIR operation without security context detected. Ensure proper authorization.")
  or
  (isFHIRClientInit(target) and not hasVersionCheck(target) and message = "FHIR client initialization without version check detected. Ensure version compatibility.")
  or
  (isFHIRSearch(target) and not hasInputSanitization(target) and message = "FHIR search operation without input sanitization detected. Ensure proper input validation.")
select target, message
