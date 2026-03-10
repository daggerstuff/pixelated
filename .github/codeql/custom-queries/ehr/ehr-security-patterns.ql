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
  (
    /* Insecure EHR Config Check */
    source instanceof EHRCredentialSource and
    (
      exists(DataFlow::CallNode call |
        call.getCalleeName().matches("%log%") and
        sink = call.getAnArgument()
      )
      or
      exists(DataFlow::PropWrite write |
        write.getPropertyName().matches("%url%") and
        sink = write.getRhs()
      )
    )
    and DataFlow::localFlow(source, sink)
  )
  or
  (
    /* Unsafe EHR Access Check */
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument() and
      exists(EHREndpoint endpoint | DataFlow::localFlow(endpoint, call.getAnArgument()))
    )
    and source = sink
  )
select sink, "Potential EHR security issue detected."
