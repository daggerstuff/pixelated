/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id js/ehr-security-patterns
 * @tags security
 *       ehr
 *       hipaa
 */

import javascript

predicate isSensitiveCredential(DataFlow::Node node) {
  exists(DataFlow::PropRead read |
    read = node and
    (
      read.getPropertyName().matches("%token%") or
      read.getPropertyName().matches("%apiKey%") or
      read.getPropertyName().matches("%secret%") or
      read.getPropertyName().matches("%password%")
    )
  )
}

predicate isDangerousSink(DataFlow::Node sink) {
  exists(DataFlow::CallNode call |
    (
      call.getCalleeName().matches("%log%") or
      call.getCalleeName().matches("%warn%") or
      call.getCalleeName().matches("%error%")
    ) and
    sink = call.getAnArgument()
  )
  or
  exists(DataFlow::PropWrite write |
    write.getPropertyName().matches("%url%") and
    sink = write.getRhs()
  )
}

from DataFlow::Node source, DataFlow::Node sink
where
  isSensitiveCredential(source) and
  isDangerousSink(sink) and
  // Check for simple local flow as a proxy for TaintTracking in this environment
  DataFlow::localFlow(source, sink)
select sink, "Potential EHR security issue: sensitive data flows to a dangerous sink."
