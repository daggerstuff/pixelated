/**
 * @name Unsafe EHR Access
 * @description Detects unsafe remote data flowing to EHR endpoints
 * @kind path-problem
 * @problem.severity error
 * @security-severity 8.5
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

module UnsafeEHRAccess implements DataFlow::ConfigSig {
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

module UnsafeEHRFlow = TaintTracking::Global<UnsafeEHRAccess>;
import UnsafeEHRFlow::PathGraph

from UnsafeEHRFlow::PathNode source, UnsafeEHRFlow::PathNode sink
where UnsafeEHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Unsafe data flows to EHR endpoint $@.",
  sink.getNode(), "dangerous sink"
