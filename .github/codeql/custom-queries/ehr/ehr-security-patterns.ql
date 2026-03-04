/**
 * @name EHR Security Checks - Pattern Detection
 * @description Detects common security issues in EHR integrations using data flow analysis
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/ehr-security-patterns
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import semmle.javascript.security.dataflow.TaintTracking

module EHRConfig implements DataFlow::ConfigSig {
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
  }
}

module EHRFlow = TaintTracking::Global<EHRConfig>;
import EHRFlow::PathGraph

from EHRFlow::PathNode source, EHRFlow::PathNode sink
where EHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: sensitive data $@ flows to log $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
