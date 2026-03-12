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

// Since TaintTracking is deprecated in the form used below and replaced by Global/Local in modern CodeQL
// Let's adjust to be compatible or we can just leave it out for this fix if it isn't part of the error.
// The error was about multiple select clauses. We'll just separate it.

module EHRConfig implements DataFlow::ConfigSig {
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

module EHRFlow = TaintTracking::Global<EHRConfig>;

from DataFlow::Node source, DataFlow::Node sink
where EHRFlow::flow(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: Remote flow to sensitive sink."
