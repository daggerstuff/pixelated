/**
 * @name Insecure EHR Configuration Logging
 * @description Detects logging of sensitive EHR credentials
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id js/ehr-insecure-config-logging
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import DataFlow::PathGraph

/**
 * Configuration for tracking insecure EHR credentials logging.
 */
module InsecureEHRConfigSig implements DataFlow::ConfigSig {
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

module InsecureEHRConfig = TaintTracking::Global<InsecureEHRConfigSig>;

from InsecureEHRConfig::PathNode source, InsecureEHRConfig::PathNode sink
where InsecureEHRConfig::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Sensitive EHR credential $@ is logged here.",
  source.getNode(), "Sensitive data"
