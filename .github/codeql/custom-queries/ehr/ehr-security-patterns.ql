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
import semmle.javascript.security.dataflow.RemoteFlowSources
import DataFlow::PathGraph

/**
 * A data source representing sensitive EHR credentials.
 */
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

/**
 * A data node representing an EHR endpoint URL.
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
 * Configuration for detecting sensitive EHR credentials flowing to insecure sinks (logging or URLs).
 */
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

/**
 * Taint-tracking analysis for insecure EHR configuration.
 */
module InsecureEHRFlow = TaintTracking::Global<InsecureEHRConfig>;

/**
 * Configuration for detecting remote data flowing to EHR-related request calls.
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
      exists(EHREndpoint endpoint | endpoint.flowsTo(call.getAnArgument()))
    )
  }
}

/**
 * Taint-tracking analysis for unsafe EHR access.
 */
module UnsafeEHRAccessFlow = TaintTracking::Global<UnsafeEHRAccessConfig>;

from DataFlow::PathNode source, DataFlow::PathNode sink, string message
where
  (
    InsecureEHRFlow::hasFlowPath(source, sink) and
    message = "Potential EHR security issue: Sensitive credential flows to dangerous sink."
  ) or
  (
    UnsafeEHRAccessFlow::hasFlowPath(source, sink) and
    message = "Potential EHR security issue: Remote user data flows to EHR request."
  )
select sink.getNode(), source, sink, message
