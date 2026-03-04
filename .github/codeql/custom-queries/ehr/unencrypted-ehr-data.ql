/**
 * @name Unencrypted EHR Data Transfer
 * @description Detects potential unencrypted EHR data transfers
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/unencrypted-ehr-data
 * @tags security
 *       hipaa
 *       ehr
 */

import javascript

private module UnencryptedEHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    exists(string name |
      name = source.asExpr().toString().toLowerCase() and
      (
        name.matches("%patient%") or
        name.matches("%health%") or
        name.matches("%record%") or
        name.matches("%ehr%") or
        name.matches("%fhir%") or
        name.matches("%clinical%")
      )
    )
  }

  predicate isSink(DataFlow::Node sink) {
    exists(CallExpr call |
      (
        call.getCalleeName().matches("%http%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%") or
        call.getCalleeName().matches("%request%")
      ) and
      sink = DataFlow::exprNode(call.getAnArgument())
    )
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(CallExpr encryptCall |
      encryptCall.getCalleeName().matches("%encrypt%") and
      node = DataFlow::exprNode(encryptCall)
    )
  }
}

module Flow = TaintTracking::Global<UnencryptedEHRConfig>;

from DataFlow::Node source, DataFlow::Node sink
where Flow::hasFlow(source, sink)
select sink, "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."
