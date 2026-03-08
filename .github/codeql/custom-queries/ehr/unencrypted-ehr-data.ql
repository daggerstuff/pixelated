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

module UnencryptedEHRDataSig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) { isEHRData(source) }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      isDataTransmissionCall(call) and
      sink = call.getAnArgument()
    )
  }
}

module UnencryptedEHRDataFlow = DataFlow::Global<UnencryptedEHRDataSig>;

from DataFlow::Node source, DataFlow::Node sink, DataFlow::CallNode call
where
  UnencryptedEHRDataFlow::flow(source, sink) and
  sink = call.getAnArgument() and
  isDataTransmissionCall(call) and
  not exists(DataFlow::CallNode encryptCall |
    encryptCall.getCalleeName().matches("%encrypt%") and
    UnencryptedEHRDataFlow::flow(source, encryptCall.getAnArgument())
  )
select call,
  "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
