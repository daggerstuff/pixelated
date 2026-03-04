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
import semmle.javascript.security.dataflow.TaintTracking
import DataFlow::PathGraph

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

/**
 * Taint tracking configuration for unencrypted EHR data transfer.
 */
module UnencryptedEHRDataConfigSig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    isEHRData(source)
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      isDataTransmissionCall(call.asExpr()) and
      sink = call.getAnArgument()
    )
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().matches("%encrypt%") and
      node = DataFlow::exprNode(call.getAnArgument())
    )
  }
}

module UnencryptedEHRDataFlow = TaintTracking::Global<UnencryptedEHRDataConfigSig>;

from DataFlow::PathNode source, DataFlow::PathNode sink
where UnencryptedEHRDataFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential unencrypted EHR data transmission detected."
