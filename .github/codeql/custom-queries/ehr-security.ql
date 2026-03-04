/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind path-problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision high
 * @id js/ehr-security
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript
import semmle.javascript.security.dataflow.RemoteFlowSources
import semmle.javascript.security.dataflow.TaintTracking
import DataFlow::PathGraph

module EHRSecurityConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource or
    exists(string name |
      name = source.asExpr().toString().toLowerCase() and
      (name.matches("%patient%") or name.matches("%record%") or name.matches("%ehr%"))
    )
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%log%") or
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument()
    )
  }
}

module EHRSecurityFlow = TaintTracking::Global<EHRSecurityConfig>;

from EHRSecurityFlow::PathNode source, EHRSecurityFlow::PathNode sink
where EHRSecurityFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
