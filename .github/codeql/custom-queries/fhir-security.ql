/**
 * @name Unvalidated FHIR Resource Access
 * @description Detects FHIR resource access without proper validation
 * @kind problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision high
 * @id js/unvalidated-fhir-access
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

// Detect FHIR resource access
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

// Detect validation calls
predicate hasValidation(CallExpr call) {
  exists(CallExpr validateCall |
    validateCall.getCalleeName().matches("%validate%") or
    validateCall.getCalleeName().matches("%check%") or
    validateCall.getCalleeName().matches("%verify%")
  )
}

// Main query
from CallExpr resourceCall
where
  isFHIRResourceAccess(resourceCall) and
  not hasValidation(resourceCall)
select resourceCall,
  "FHIR resource access without validation detected. Ensure proper validation before access."

/**
 * @name Insecure FHIR Operations
 * @description Detects potentially insecure FHIR operations
 * @kind problem
 * @problem.severity warning
 * @security-severity 7.5
 * @precision high
 * @id js/insecure-fhir-ops
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

// Detect FHIR operations
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

// Detect security context
predicate hasSecurityContext(CallExpr call) {
  exists(CallExpr securityCall |
    securityCall.getCalleeName().matches("%authorize%") or
    securityCall.getCalleeName().matches("%checkPermission%") or
    securityCall.getCalleeName().matches("%verifyAccess%")
  )
}

// Main query
from CallExpr fhirOp
where
  isFHIROperation(fhirOp) and
  not hasSecurityContext(fhirOp)
select fhirOp,
  "FHIR operation without security context detected. Ensure proper authorization."

/**
 * @name Missing FHIR Version Check
 * @description Detects FHIR operations without version compatibility checks
 * @kind problem
 * @problem.severity warning
 * @security-severity 5.0
 * @precision high
 * @id js/missing-fhir-version
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

// Detect FHIR client initialization
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

// Detect version checks
predicate hasVersionCheck(CallExpr call) {
  exists(CallExpr versionCall |
    versionCall.getCalleeName().matches("%version%") or
    versionCall.getCalleeName().matches("%compatibility%") or
    versionCall.getCalleeName().matches("%checkVersion%")
  )
}

// Main query
from CallExpr clientInit
where
  isFHIRClientInit(clientInit) and
  not hasVersionCheck(clientInit)
select clientInit,
  "FHIR client initialization without version check detected. Ensure version compatibility."

/**
 * @name Insecure FHIR Search
 * @description Detects potentially insecure FHIR search operations
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.5
 * @precision high
 * @id js/insecure-fhir-search
 * @tags security
 *       hipaa
 *       fhir
 */

import javascript

// Detect FHIR search operations
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

// Detect input sanitization
predicate hasInputSanitization(CallExpr call) {
  exists(CallExpr sanitizeCall |
    sanitizeCall.getCalleeName().matches("%sanitize%") or
    sanitizeCall.getCalleeName().matches("%escape%") or
    sanitizeCall.getCalleeName().matches("%validate%")
  )
}

// Main query
from CallExpr searchOp
where
  isFHIRSearch(searchOp) and
  not hasInputSanitization(searchOp)
select searchOp,
  "FHIR search operation without input sanitization detected. Ensure proper input validation."
