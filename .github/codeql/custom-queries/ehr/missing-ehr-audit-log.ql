/**
 * @name Missing EHR Audit Logging
 * @description Detects EHR operations without audit logging
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.0
 * @precision high
 * @id js/missing-ehr-audit-log
 * @tags security
 *       hipaa
 *       audit
 */

import javascript

predicate isEHROperation(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%patient%") or
      name.matches("%record%") or
      name.matches("%ehr%") or
      name.matches("%fhir%")
    )
  )
}

predicate hasLogging() {
  exists(CallExpr logCall |
    logCall.getCalleeName().matches("%log%") or
    logCall.getCalleeName().matches("%audit%")
  )
}

from CallExpr ehrOp
where
  isEHROperation(ehrOp) and
  not hasLogging()
select ehrOp,
  "EHR operation detected without audit logging. HIPAA compliance requires comprehensive audit trails."
