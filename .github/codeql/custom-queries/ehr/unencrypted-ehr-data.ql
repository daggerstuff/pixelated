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
import semmle.javascript.security.dataflow.RemoteFlowSources
import DataFlow::PathGraph

/**
 * Sources of potential EHR data.
 */
class EHRDataSource extends DataFlow::Node {
  EHRDataSource() {
    exists(string name |
      name = this.asExpr().toString().toLowerCase() and
      (
        name.matches("%patient%") or
        name.matches("%health%") or
        name.matches("%record%") or
        name.matches("%ehr%") or
        name.matches("%fhir%") or
        name.matches("%clinical%")
      )
    )
    or
    this instanceof RemoteFlowSource
  }
}

/**
 * Data transmission sinks.
 */
class TransmissionSink extends DataFlow::Node {
  TransmissionSink() {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%http%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%") or
        call.getCalleeName().matches("%request%")
      ) and
      this = call.getAnArgument()
    )
  }
}

/**
 * Configuration for detecting unencrypted data reaching transmission sinks.
 */
module UnencryptedEHRDataConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof EHRDataSource
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof TransmissionSink
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().matches("%encrypt%") and
      node = call.getAnArgument()
    )
  }
}

module UnencryptedEHRDataFlow = TaintTracking::Global<UnencryptedEHRDataConfig>;

from DataFlow::PathNode source, DataFlow::PathNode sink
where UnencryptedEHRDataFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential unencrypted EHR data transmission: $@ flows to $@.",
  source.getNode(), "EHR data", sink.getNode(), "unencrypted sink"
