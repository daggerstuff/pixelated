/**
 * @name EHR Security Checks
 * @description Detects potential unencrypted EHR data transfers or insecure authentication
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/ehr-security-checks
 * @tags security
 *       hipaa
 *       ehr
 */

import javascript

predicate isDataTransmissionCall(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%http%") or
      name.matches("%fetch%") or
      name.matches("%axios%") or
      name.matches("%request%")
    )
  )
}

predicate isEHRData(DataFlow::Node node) {
  exists(string name |
    name = node.asExpr().toString().toLowerCase() and
    (
      name.matches("%patient%") or
      name.matches("%health%") or
      name.matches("%record%") or
      name.matches("%ehr%") or
      name.matches("%fhir%") or
      name.matches("%clinical%")
    )
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

from CallExpr call
where
  (
    isDataTransmissionCall(call) and
    exists(DataFlow::Node data |
      isEHRData(data) and
      not exists(CallExpr encryptCall |
        encryptCall.getCalleeName().matches("%encrypt%") and
        DataFlow::localFlow(data, DataFlow::exprNode(encryptCall.getAnArgument()))
      )
    )
  ) or
  (
    isAuthenticationMethod(call) and
    not exists(CallExpr mfaCall |
      mfaCall.getCalleeName().matches("%mfa%") or
      mfaCall.getCalleeName().matches("%2fa%") or
      mfaCall.getCalleeName().matches("%verify%")
    )
  )
select call, "Potential EHR security issue detected (unencrypted transmission or weak authentication)."
