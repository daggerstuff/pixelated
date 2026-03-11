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

from DataFlow::Node source, DataFlow::Node sink
where
  source instanceof EHRCredentialSource and
  exists(DataFlow::CallNode call |
    call.getCalleeName().matches("%log%") and
    sink = call.getAnArgument() and
    DataFlow::localFlow(source, sink)
  )
select sink, "Potential leak of EHR credentials to log file."
