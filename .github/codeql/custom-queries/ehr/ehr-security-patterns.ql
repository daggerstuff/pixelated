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
 * A data node representing an EHR endpoint URL constant.
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

from DataFlow::Node source, DataFlow::Node sink, string message
where
  (
    // Insecure config: credentials to logging or URLs
    source instanceof EHRCredentialSource and
    (
      exists(DataFlow::CallNode call |
        call.getCalleeName().matches("%log%") and
        DataFlow::localFlow(source, call.getAnArgument()) and
        sink = call.getAnArgument()
      ) or
      exists(DataFlow::PropWrite write |
        write.getPropertyName().matches("%url%") and
        DataFlow::localFlow(source, write.getRhs()) and
        sink = write.getRhs()
      )
    ) and
    message = "Sensitive credential flows to dangerous sink."
  ) or (
    // Unsafe access: user data to EHR request
    source instanceof RemoteFlowSource and
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      DataFlow::localFlow(source, call.getAnArgument()) and
      exists(EHREndpoint endpoint |
        DataFlow::localFlow(endpoint, call.getAnArgument()) or
        endpoint = call.getAnArgument()
      ) and
      sink = call.getAnArgument()
    ) and
    message = "Remote user data flows to EHR request."
  )
select sink, "Potential EHR security issue: " + message
