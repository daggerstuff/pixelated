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

/**
 * Predicate to identify sensitive EHR-related data.
 */
predicate isEHRData(DataFlow::Node node) {
  exists(string name |
    name = node.asExpr().toString().toLowerCase() and
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

/**
 * Predicate to identify data transmission calls.
 */
predicate isDataTransmissionSink(DataFlow::Node sink) {
  exists(DataFlow::CallNode call |
    call.getCalleeName().matches("%http%") or
    call.getCalleeName().matches("%fetch%") or
    call.getCalleeName().matches("%axios%") or
    call.getCalleeName().matches("%request%")
  |
    sink = call.getAnArgument()
  )
}

/**
 * Predicate to identify encryption calls that serve as barriers.
 */
predicate isEncryptionBarrier(DataFlow::Node node) {
  exists(DataFlow::CallNode call |
    call.getCalleeName().matches("%encrypt%")
  |
    node = call.getAnArgument()
  )
}

module UnencryptedEHRConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    isEHRData(source)
  }

  predicate isSink(DataFlow::Node sink) {
    isDataTransmissionSink(sink)
  }

  predicate isBarrier(DataFlow::Node node) {
    isEncryptionBarrier(node)
  }
}

module UnencryptedEHRFlow = TaintTracking::Global<UnencryptedEHRConfig>;

from DataFlow::Node source, DataFlow::Node sink
where UnencryptedEHRFlow::hasFlow(source, sink)
select sink, "Potential unencrypted EHR data transmission detected from $@. HIPAA compliance requires encryption.", source, "EHR data source"
