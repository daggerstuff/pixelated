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

module UnencryptedEHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(string name |
      name = source.asExpr().toString().toLowerCase() and
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

  predicate isSink(DataFlow::Node sink) {
    exists(CallExpr call |
      sink = DataFlow::exprNode(call.getAnArgument()) and
      exists(string name |
        name = call.getCalleeName() and
        (
          name.matches("%http%") or
          name.matches("%fetch%") or
          name.matches("%axios%") or
          name.matches("%request%")
        )
      )
    )
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(CallExpr encryptCall |
      encryptCall.getCalleeName().matches("%encrypt%") and
      node = DataFlow::exprNode(encryptCall.getAnArgument())
    )
  }
}

module UnencryptedEHRFlow = TaintTracking::Global<UnencryptedEHRConfig>;
import UnencryptedEHRFlow::PathGraph

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

from UnencryptedEHRFlow::PathNode source, UnencryptedEHRFlow::PathNode sink
where UnencryptedEHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink,
  "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
