/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind problem
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
import semmle.javascript.DataFlow

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

/**
 * DEPRECATED: Using the new TaintTracking::Configuration API is recommended.
 * However, keep this for compatibility if the extractor version requires it.
 */
class InsecureEHRConfig extends TaintTracking::Configuration {
  InsecureEHRConfig() { this = "InsecureEHRConfig" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof EHRCredentialSource
  }

  override predicate isSink(DataFlow::Node sink) {
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

class UnsafeEHRAccess extends TaintTracking::Configuration {
  UnsafeEHRAccess() { this = "UnsafeEHRAccess" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument() and
      exists(EHREndpoint endpoint | DataFlow::localFlow(endpoint, call.getAnArgument()))
    )
  }
}

from DataFlow::Node source, DataFlow::Node sink, TaintTracking::Configuration config
where
  (
    config instanceof InsecureEHRConfig or
    config instanceof UnsafeEHRAccess
  ) and
  config.hasFlow(source, sink)
select sink, "Potential EHR security issue: Sensitive data from $@ flows to dangerous sink $@.",
  source, source.toString(), sink, sink.toString()
