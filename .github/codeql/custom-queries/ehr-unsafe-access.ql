/**
 * @name Unsafe EHR Access
 * @description Detects user-controlled data flowing into EHR API requests
 * @kind path-problem
 * @problem.severity error
 * @precision high
 * @id js/ehr-unsafe-access
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import DataFlow::PathGraph

/**
 * Configuration for tracking unsafe EHR endpoint access with remote data.
 */
module UnsafeEHRAccessSig implements DataFlow::ConfigSig {
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
      sink = call.getAnArgument()
    )
  }
}

module UnsafeEHRAccess = TaintTracking::Global<UnsafeEHRAccessSig>;

from UnsafeEHRAccess::PathNode source, UnsafeEHRAccess::PathNode sink
where
  UnsafeEHRAccess::hasFlowPath(source, sink) and
  exists(DataFlow::CallNode call |
    sink.getNode() = call.getAnArgument() and
    exists(string url |
      (
        url.matches("%/fhir/%") or
        url.matches("%/ehr/%") or
        url.matches("%/api/v%") or
        url.matches("%/epic/%") or
        url.matches("%/cerner/%") or
        url.matches("%/allscripts/%")
      ) and
      // Check if any argument of the call is this URL string
      call.getAnArgument().getStringValue() = url
    )
  )
select sink.getNode(), source, sink, "User-controlled data $@ flows to an EHR API request.",
  source.getNode(), "Remote flow source"
