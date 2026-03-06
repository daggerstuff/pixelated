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
import semmle.javascript.security.dataflow.TaintTracking
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
    or
    exists(DataFlow::PropWrite write |
      write.getPropertyName().matches("%url%") and
      sink = write.getRhs()
    )
  }
}

module InsecureEHRConfig = TaintTracking::Global<InsecureEHRConfigSig>;

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
      sink = call.getAnArgument() and
      exists(DataFlow::Node endpoint |
        exists(string url |
          url = endpoint.getStringValue() and
          (
            url.matches("%/fhir/%") or
            url.matches("%/ehr/%") or
            url.matches("%/api/v%") or
            url.matches("%/epic/%") or
            url.matches("%/cerner/%") or
            url.matches("%/allscripts/%")
          )
        ) and
        endpoint.flowsTo(call.getAnArgument())
      )
    )
  }
}

module UnsafeEHRAccess = TaintTracking::Global<UnsafeEHRAccessSig>;

from DataFlow::PathNode source, DataFlow::PathNode sink
where
  InsecureEHRConfig::hasFlowPath(source, sink) or
  UnsafeEHRAccess::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
