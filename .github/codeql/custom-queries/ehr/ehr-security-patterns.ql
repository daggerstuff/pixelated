/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id js/ehr-security
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import semmle.dataflow.TaintTracking.PathGraph

// Define the TaintTracking configuration locally following new API style
module EHRSecurityConfig implements DataFlow::ConfigSig {
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
    or
    source instanceof RemoteFlowSource
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
    or
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

module EHRSecurityFlow = TaintTracking::Global<EHRSecurityConfig>;

from EHRSecurityFlow::PathNode source, EHRSecurityFlow::PathNode sink
where EHRSecurityFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"