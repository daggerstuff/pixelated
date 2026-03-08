/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind path-problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision high
 * @id js/ehr-security-patterns
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import DataFlow::PathGraph

/**
 * Modern CodeQL DataFlow configuration for EHR security patterns
 */
module EHRSecurityConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(string propName |
      source.(DataFlow::PropRead).getPropertyName() = propName and
      (
        propName.matches("%token%") or
        propName.matches("%apiKey%") or
        propName.matches("%secret%") or
        propName.matches("%password%")
      )
    )
    or
    source instanceof RemoteFlowSource
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%log%") or
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

module EHRSecurityFlow = TaintTracking::Global<EHRSecurityConfig>;

from EHRSecurityFlow::PathNode source, EHRSecurityFlow::PathNode sink
where EHRSecurityFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
