/**
 * @name EHR Security Checks - Unsafe Remote Access
 * @description Detects user-controlled data flowing to EHR endpoints
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/unsafe-ehr-access
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import semmle.javascript.security.dataflow.TaintTracking

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

module UnsafeEHRAccessConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument() and
      any(EHREndpoint endpoint).flowsTo(call.getAnArgument())
    )
  }
}

module UnsafeEHRAccessFlow = TaintTracking::Global<UnsafeEHRAccessConfig>;
import UnsafeEHRAccessFlow::PathGraph

from UnsafeEHRAccessFlow::PathNode source, UnsafeEHRAccessFlow::PathNode sink
where UnsafeEHRAccessFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: remote input $@ flows to EHR endpoint $@.",
  source.getNode(), "Remote input", sink.getNode(), "EHR endpoint"
