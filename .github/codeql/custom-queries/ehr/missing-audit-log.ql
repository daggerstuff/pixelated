/**
 * @name Missing Audit Logging
 * @description Detects EHR operations without audit logging
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.0
 * @precision high
 * @id js/missing-audit-log
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

predicate hasLogging(CallExpr call) {
  exists(CallExpr logCall |
    logCall.getEnclosingFunction() = call.getEnclosingFunction() and
    (
      logCall.getCalleeName().matches("%auditLog%") or
      // Simple audit keyword
      logCall.getCalleeName().matches("%audit%") or
      // Qualified accesses such as logger.audit or logger.auditLog
      logCall.getCalleeName().matches("%logger.audit%") or
      logCall.getCalleeName().matches("%logger.auditLog%") or
      // More flexible but still audit‑specific: audit, trace, or record followed by log
      logCall.getCalleeName().regexpMatch("(?i)\\b(audit|trace|record)\\w*\\b.*log.*")
    )
  )
}

from CallExpr ehrOp
where
  isEHROperation(ehrOp) and
  not hasLogging(ehrOp)
select ehrOp,
  "EHR operation detected without audit logging. HIPAA compliance requires comprehensive audit trails."