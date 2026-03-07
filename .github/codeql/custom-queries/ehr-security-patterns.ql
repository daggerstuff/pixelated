/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind path-problem
 * @problem.severity error
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
 * A configuration for tracking taint from remote sources to EHR endpoints.
 */
module EHRSecurityConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
    or
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
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%") or
        call.getCalleeName().matches("%log%")
      ) and
      sink = call.getAnArgument()
    )
  }
}

/**
 * Taint tracking for EHR security patterns.
 */
module EHRSecurityTaintTracking = TaintTracking::Global<EHRSecurityConfig>;

from EHRSecurityTaintTracking::PathNode source, EHRSecurityTaintTracking::PathNode sink
where EHRSecurityTaintTracking::flowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
