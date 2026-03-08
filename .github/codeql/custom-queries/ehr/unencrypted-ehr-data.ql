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
import DataFlow::PathGraph

module EHRNoEncryptionConfig implements DataFlow::ConfigSig {
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
    exists(DataFlow::CallNode call |
      exists(string name |
        name = call.getCalleeName() and
        (
          name.matches("%http%") or
          name.matches("%fetch%") or
          name.matches("%axios%") or
          name.matches("%request%")
        )
      ) and
      sink = call.getAnArgument()
    )
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(DataFlow::CallNode encryptCall |
      encryptCall.getCalleeName().matches("%encrypt%") and
      node = encryptCall.getAnArgument()
    )
  }
}

module EHRNoEncryptionFlow = TaintTracking::Global<EHRNoEncryptionConfig>;

from EHRNoEncryptionFlow::PathNode source, EHRNoEncryptionFlow::PathNode sink
where EHRNoEncryptionFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
