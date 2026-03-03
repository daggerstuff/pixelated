/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations using data flow analysis
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/ehr-dataflow-checks
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import semmle.javascript.security.dataflow.TaintTracking
import DataFlow::PathGraph

/**
 * A data flow configuration signature for insecure EHR configuration.
 */
module InsecureEHRConfigConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(DataFlow::PropRead read |
      read = source and
      (
        read.getPropertyName().matches("%token%") or
        read.getPropertyName().matches("%apiKey%") or
        read.getPropertyName().matches("%secret%") or
        read.getPropertyName().matches("%password%")
      )
    )
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().matches("%log%") and
      sink = call.getAnArgument()
    )
    or
    exists(DataFlow::PropWrite write |
      write.getPropertyName().matches("%url%") and
      sink = write.getRhs()
    )
  }
}

/**
 * A data flow configuration signature for unsafe EHR access.
 */
module UnsafeEHRAccessConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument()
    )
  }
}

/**
 * Global data flow for insecure EHR configuration.
 */
module InsecureEHRConfigFlow = TaintTracking::Global<InsecureEHRConfigConfig>;

/**
 * Global data flow for unsafe EHR access.
 */
module UnsafeEHRAccessFlow = TaintTracking::Global<UnsafeEHRAccessConfig>;

from DataFlow::PathNode source, DataFlow::PathNode sink
where
  InsecureEHRConfigFlow::hasFlowPath(source, sink) or
  UnsafeEHRAccessFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
