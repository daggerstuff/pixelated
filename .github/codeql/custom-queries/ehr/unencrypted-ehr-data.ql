/**
 * @name Unencrypted EHR Data Transfer
 * @description Detects potential unencrypted EHR data transfers
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/unencrypted-ehr-data
 * @tags security
 *       hipaa
 *       ehr
 */

import javascript

predicate isDataTransmissionCall(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%httpRequest%") or
      name.matches("%httpPost%") or
      name.matches("%httpGet%") or
      name.matches("%axios%") or
      name.matches("%fetch%")
    )
  )
}

predicate isEHRData(DataFlow::Node node) {
  exists(string name |
    name = node.asExpr().toString().toLowerCase() and
    (
      name.matches("%patient%") or
      name.matches("%health%") or
      name.matches("%medical_record%") or
      name.matches("%ehr%") or
      name.matches("%fhir%") or
      name.matches("%clinical%")
    )
  )
}

from CallExpr call, DataFlow::Node data
where
  isDataTransmissionCall(call) and
  isEHRData(data) and
  exists(arg | DataFlow::localFlow(data, DataFlow::exprNode(arg)) and call.getAnArgument() = arg) and
  not exists(CallExpr encryptCall |
    encryptCall.getCalleeName().matches("%encrypt%") and
    DataFlow::localFlow(data, DataFlow::exprNode(encryptCall.getAnArgument()))
  )
select call,
  "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."