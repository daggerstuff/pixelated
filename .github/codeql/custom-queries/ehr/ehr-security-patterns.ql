/**
 * @name EHR Security Pattern Detection
 * @kind path-problem
 * @id js/ehr-security
 * @tags security ehr hipaa
 */
import javascript
import semmle.javascript.security.dataflow.TaintTracking
import DataFlow::PathGraph
module InsecureEHRConfigSig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(DataFlow::PropRead r | r = source and r.getPropertyName().matches("%token%"))
  }
  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode c | c.getCalleeName().matches("%log%") and sink = c.getAnArgument())
  }
}
module InsecureEHRConfigFlow = TaintTracking::Global<InsecureEHRConfigSig>;
from DataFlow::PathNode source, DataFlow::PathNode sink
where InsecureEHRConfigFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.", source.getNode(), "sensitive data", sink.getNode(), "dangerous sink"
