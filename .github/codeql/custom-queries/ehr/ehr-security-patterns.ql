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
import DataFlow::PathGraph

module EHRSecurityConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    // Source 1: EHR Credentials
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
    // Source 2: Remote Flow Sources
    source instanceof RemoteFlowSource
  }

  predicate isSink(DataFlow::Node sink) {
    // Sink 1: Logging sensitive data
    exists(DataFlow::CallNode call |
      call.getCalleeName().matches("%log%") and
      sink = call.getAnArgument()
    )
    or
    // Sink 2: Sensitive data in URL
    exists(DataFlow::PropWrite write |
      write.getPropertyName().matches("%url%") and
      sink = write.getRhs()
    )
    or
    // Sink 3: Remote flow sources used in EHR request
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
where EHRSecurityFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
