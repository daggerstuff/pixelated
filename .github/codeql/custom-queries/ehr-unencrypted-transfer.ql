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

predicate isDataTransmissionCall(DataFlow::CallNode call) {
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

from DataFlow::CallNode call, DataFlow::Node data
where
  isDataTransmissionCall(call) and
  isEHRData(data) and
  data = call.getAnArgument() and
  not exists(DataFlow::CallNode encryptCall |
    encryptCall.getCalleeName().matches("%encrypt%") and
    data.flowsTo(encryptCall.getAnArgument())
  )
select call,
  "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
