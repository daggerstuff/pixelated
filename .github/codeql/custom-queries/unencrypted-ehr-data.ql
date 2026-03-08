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

module UnencryptedEHRDataConfig implements DataFlow::ConfigSig {
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
      exists(string name |
        name = call.getCalleeName() and
        (
          name.matches("%http%") or
          name.matches("%fetch%") or
          name.matches("%axios%") or
          name.matches("%request%")
        )
      ) and
      sink.asExpr() = call.getAnArgument()
    )
  }

  predicate isBarrier(DataFlow::Node node) {
    exists(CallExpr encryptCall |
      encryptCall.getCalleeName().matches("%encrypt%") and
      node.asExpr() = encryptCall.getAnArgument()
    )
  }
}

module UnencryptedEHRDataFlow = TaintTracking::Global<UnencryptedEHRDataConfig>;

from DataFlow::Node source, DataFlow::Node sink
where UnencryptedEHRDataFlow::flow(source, sink)
select sink, "Potential unencrypted EHR data transmission from $@. HIPAA compliance requires encryption.",
  source, "source of EHR data"
