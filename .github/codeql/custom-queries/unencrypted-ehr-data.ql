/**
 * @name Unencrypted EHR Data Transfer
 * @description Detects potential unencrypted EHR data transfers
 * @kind path-problem
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

module UnencryptedEHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) { isEHRData(source) }

  predicate isSink(DataFlow::Node sink) {
    exists(CallExpr call |
      isDataTransmissionCall(call) and
      sink = DataFlow::exprNode(call.getAnArgument())
    )
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(CallExpr encryptCall |
      encryptCall.getCalleeName().matches("%encrypt%") and
      node = DataFlow::exprNode(encryptCall)
    )
  }
}

module Flow = TaintTracking::Global<UnencryptedEHRConfig>;
import Flow::PathGraph

from Flow::PathNode source, Flow::PathNode sink
where Flow::hasFlowPath(source, sink)
select sink.getNode(), source, sink,
  "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
