/**
 * @name Insecure EHR Credential Leak
 * @description Detects potential EHR credential leaks to logs or URLs
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id js/insecure-ehr-credential-leak
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources

class EHRCredentialSource extends DataFlow::Node {
  EHRCredentialSource() {
    exists(DataFlow::PropRead read |
      read = this and
      (
        read.getPropertyName().matches("%token%") or
        read.getPropertyName().matches("%apiKey%") or
        read.getPropertyName().matches("%secret%") or
        read.getPropertyName().matches("%password%")
      )
    )
  }
}

module InsecureEHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof EHRCredentialSource
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
select sink.getNode(), source, sink, "Potential EHR credential leak: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
