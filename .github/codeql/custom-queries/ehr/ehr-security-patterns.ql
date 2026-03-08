/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id js/ehr-security
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources

/**
 * A source node representing EHR credentials.
 */
class EHRCredentialSource extends DataFlow::SourceNode {
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
 * A source node representing an EHR endpoint URL.
 */
class EHREndpoint extends DataFlow::SourceNode {
  EHREndpoint() {
    exists(string url |
      url = this.asExpr().(StringLiteral).getValue() and
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
 * Configuration for detecting insecure EHR credential usage.
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

module InsecureEHRFlow = TaintTracking::Global<InsecureEHRConfig>;

/**
 * Configuration for detecting unsafe EHR endpoint access.
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
      // Use SourceNode.flowsTo() as recommended by repository memory
      exists(EHREndpoint endpoint |
        endpoint.flowsTo(call.getAnArgument())
      )
    )
  }
}

module UnsafeEHRAccessFlow = TaintTracking::Global<UnsafeEHRAccessConfig>;

from DataFlow::Node source, DataFlow::Node sink, string msg
where
  (
    InsecureEHRFlow::hasFlow(source, sink) and msg = "Potential EHR security issue: sensitive data flows to log/URL."
  ) or (
    UnsafeEHRAccessFlow::hasFlow(source, sink) and msg = "Potential EHR security issue: remote input flows to unsafe EHR access."
  )
select sink, msg
