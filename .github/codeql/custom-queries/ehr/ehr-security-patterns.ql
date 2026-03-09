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

module EHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource or
    exists(DataFlow::PropRead read |
      read = source and
      read.getPropertyName().regexpMatch("(?i).*(token|apiKey|secret|password).*")
    )
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().regexpMatch("(?i).*log.*") and
      sink = call.getAnArgument()
    ) or
    exists(DataFlow::PropWrite write |
      write.getPropertyName() = "url" and
      sink = write.getRhs()
    ) or
    exists(DataFlow::CallNode call, string url |
      call.getCalleeName().regexpMatch("(?i).*(request|fetch|axios).*") and
      url = call.getAnArgument().getStringValue() and
      url.regexpMatch(".*(/fhir/|/ehr/|/api/v|/epic/|/cerner/|/allscripts/).*") and
      sink = call.getAnArgument()
    )
  }
}

module EHRFlow = TaintTracking::Global<EHRConfig>;
import EHRFlow::PathGraph

from EHRFlow::PathNode source, EHRFlow::PathNode sink
where EHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.", source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
