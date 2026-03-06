/**
 * @name EHR Unsafe Remote Data Access
 * @description Detects remote data flowing to sensitive EHR endpoints without validation
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id js/ehr/unsafe-remote-data-access
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript

/**
 * A string representing an EHR-related endpoint URL.
 */
class EHREndpoint extends string {
  EHREndpoint() {
    this.matches("%/fhir/%") or
    this.matches("%/ehr/%") or
    this.matches("%/api/v%") or
    this.matches("%/epic/%") or
    this.matches("%/cerner/%") or
    this.matches("%/allscripts/%")
  }
}

/**
 * Data flow configuration for tracking remote data to sensitive EHR endpoints.
 */
module UnsafeEHRAccessConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(RemoteFlowSource rfs | rfs = source)
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument() and
      exists(DataFlow::Node endpointNode |
        endpointNode.getStringValue() instanceof EHREndpoint and
        DataFlow::localFlow(endpointNode, call.getAnArgument())
      )
    )
  }
}

module UnsafeEHRAccessFlow = TaintTracking::Global<UnsafeEHRAccessConfig>;
import UnsafeEHRAccessFlow::PathGraph

from UnsafeEHRAccessFlow::PathNode source, UnsafeEHRAccessFlow::PathNode sink
where UnsafeEHRAccessFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: remote data flows to EHR endpoint $@.", source.getNode(), "remote data"
