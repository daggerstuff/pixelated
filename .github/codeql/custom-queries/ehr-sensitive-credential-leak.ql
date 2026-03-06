/**
 * @name EHR Sensitive Credential Leak
 * @description Detects sensitive credentials flowing to insecure sinks like logs or URLs
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id js/ehr/sensitive-credential-leak
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript

/**
 * Data flow configuration for tracking sensitive credentials to insecure sinks.
 */
module InsecureEHRConfig implements DataFlow::ConfigSig {
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

module InsecureEHRFlow = TaintTracking::Global<InsecureEHRConfig>;
import InsecureEHRFlow::PathGraph

from InsecureEHRFlow::PathNode source, InsecureEHRFlow::PathNode sink
where InsecureEHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: sensitive credential flows to $@.", source.getNode(), "sensitive data"
