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

class EHREndpoint extends DataFlow::Node {
  EHREndpoint() {
    exists(string url |
      url = this.getStringValue() and
      (
        url.matches("%/fhir/%") or
        url.matches("%/ehr/%") or
        url.matches("%/api/v%") or
        url.matches("%/epic/%") or
        url.matches("%/cerner/%") or
        url.matches("%/allscripts/%")
      )
    )
  }
}

module EHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof EHRCredentialSource or
    source instanceof RemoteFlowSource
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%log%") and
        sink = call.getAnArgument()
      )
      or
      (
        (
          call.getCalleeName().matches("%request%") or
          call.getCalleeName().matches("%fetch%") or
          call.getCalleeName().matches("%axios%")
        ) and
        sink = call.getAnArgument() and
        any(EHREndpoint endpoint).flowsTo(call.getAnArgument())
      )
    )
    or
    exists(DataFlow::PropWrite write |
      write.getPropertyName().matches("%url%") and
      sink = write.getRhs()
    )
  }
}

module EHRFlow = TaintTracking::Global<EHRConfig>;

from EHRFlow::PathNode source, EHRFlow::PathNode sink
where EHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
