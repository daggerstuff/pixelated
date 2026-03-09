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

module EHRSecurityConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource or
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
    or
    exists(DataFlow::CallNode call, DataFlow::Node endpoint |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument() and
      (
        endpoint.getStringValue().matches("%/fhir/%") or
        endpoint.getStringValue().matches("%/ehr/%") or
        endpoint.getStringValue().matches("%/api/v%") or
        endpoint.getStringValue().matches("%/epic/%") or
        endpoint.getStringValue().matches("%/cerner/%") or
        endpoint.getStringValue().matches("%/allscripts/%")
      ) and
      endpoint.getASuccessor*() = sink
    )
  }
}

module EHRSecurityFlow = DataFlow::Global<EHRSecurityConfig>;

from DataFlow::Node source, DataFlow::Node sink
where EHRSecurityFlow::flow(source, sink)
select sink, "Potential EHR security issue: sensitive data flows to dangerous sink."
