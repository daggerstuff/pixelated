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

/**
 * A configuration for detecting sensitive EHR credentials flowing to dangerous sinks.
 */
module EHRFlowConfig implements DataFlow::ConfigSig {
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

/**
 * Taint tracking for sensitive EHR credentials.
 */
module EHRFlow = TaintTracking::Global<EHRFlowConfig>;

/**
 * An endpoint that likely represents an EHR or health data API.
 */
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

/**
 * A configuration for detecting unsafe EHR access from remote inputs.
 */
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
      // Check if the argument is related to an EHREndpoint
      exists(EHREndpoint endpoint |
        TaintTracking::localTaint(endpoint, call.getAnArgument())
      )
    )
  }
}

/**
 * Taint tracking for unsafe EHR access.
 */
module UnsafeEHRAccess = TaintTracking::Global<UnsafeEHRAccessConfig>;

from DataFlow::PathNode source, DataFlow::PathNode sink
where
  EHRFlow::hasFlowPath(source, sink) or
  UnsafeEHRAccess::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue:  flows to .",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
