/**
 * @name Unencrypted EHR Data Transfer
 * @description Detects potential unencrypted EHR data transfers
 * @kind path-problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/unencrypted-ehr-data
 * @tags security
 *       hipaa
 *       ehr
 */

import javascript

module UnencryptedEHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(string s |
      s = source.asExpr().toString().toLowerCase() and
      s.regexpMatch(".*(patient|health|record|ehr|fhir|clinical).*")
    )
  }

  predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().regexpMatch("(?i).*(http|fetch|axios|request).*") and
      sink = call.getAnArgument()
    )
  }

  predicate isSanitizer(DataFlow::Node node) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().regexpMatch("(?i).*encrypt.*") and
      node = call.getAnArgument()
    )
  }
}

module UnencryptedEHRFlow = TaintTracking::Global<UnencryptedEHRConfig>;
import UnencryptedEHRFlow::PathGraph

from UnencryptedEHRFlow::PathNode source, UnencryptedEHRFlow::PathNode sink
where UnencryptedEHRFlow::hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
