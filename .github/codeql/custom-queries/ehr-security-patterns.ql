/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.5
 * @precision high
 * @id js/ehr-security-patterns
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import DataFlow::PathGraph

/**
 * Configuration for tracking sensitive EHR data.
 */
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
      (
        call.getCalleeName().matches("%log%") or
        call.getCalleeName().matches("%audit%") or
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
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
 * Taint tracking for EHR security issues.
 */
module EHRSecurityTaintTracking = TaintTracking::Global<EHRSecurityConfig>;

from EHRSecurityTaintTracking::PathNode source, EHRSecurityTaintTracking::PathNode sink
where EHRSecurityTaintTracking::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive EHR data", sink.getNode(), "dangerous sink"
