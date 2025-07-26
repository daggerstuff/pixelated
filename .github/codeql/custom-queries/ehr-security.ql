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

// Detect unencrypted data transmission
predicate isDataTransmissionCall(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%http%") or
      name.matches("%fetch%") or
      name.matches("%axios%") or
      name.matches("%request%")
    )
  )
}

// Detect EHR-related variables
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

// Main query
from CallExpr call, DataFlow::Node data
where
  isDataTransmissionCall(call) and
  isEHRData(data) and
  not exists(CallExpr encryptCall |
    encryptCall.getCalleeName().matches("%encrypt%") and
    DataFlow::localFlow(data, DataFlow::exprNode(encryptCall.getAnArgument()))
  )
select call,
  "Potential unencrypted EHR data transmission detected. HIPAA compliance requires encryption."

/**
 * @name Insecure EHR Authentication
 * @description Detects weak authentication methods for EHR access
 * @kind problem
 * @problem.severity error
 * @security-severity 8.0
 * @precision high
 * @id js/insecure-ehr-auth
 * @tags security
 *       hipaa
 *       authentication
 */

import javascript

// Detect authentication methods
predicate isAuthenticationMethod(CallExpr call) {
  exists(string name |
    name = call.getCalleeName() and
    (
      name.matches("%login%") or
      name.matches("%authenticate%") or
      name.matches("%auth%")
    )
  )
}

// Detect weak authentication patterns
from CallExpr authCall
where
  isAuthenticationMethod(authCall) and
  not exists(CallExpr mfaCall |
    mfaCall.getCalleeName().matches("%mfa%") or
    mfaCall.getCalleeName().matches("%2fa%") or
    mfaCall.getCalleeName().matches("%verify%")
  )
select authCall,
  "Potential insecure EHR authentication detected. HIPAA compliance requires strong authentication."

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

// Detect EHR operations
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

// Detect logging calls
predicate hasLogging(CallExpr call) {
  exists(CallExpr logCall |
    logCall.getCalleeName().matches("%log%") or
    logCall.getCalleeName().matches("%audit%")
  )
}

// Main query
from CallExpr ehrOp
where
  isEHROperation(ehrOp) and
  not hasLogging(ehrOp)
select ehrOp,
  "EHR operation detected without audit logging. HIPAA compliance requires comprehensive audit trails."

/**
 * @name EHR Security Pattern Detection
 * @description Detects common security issues in EHR integrations
 * @kind problem
 * @problem.severity error
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

class EHRCredentialSource extends DataFlow::Node {
  EHRCredentialSource() {
    exists(DataFlow::PropRead read |
      read = this and
      (
        read.getPropertyName().matches("%token%") or
        read.getPropertyName().matches("%apiKey%") or
        read.getPropertyName().matches("%secret%") or
        read.getPropertyName().matches("%password%")
      )
    )
  }
}

class EHREndpoint extends DataFlow::Node {
  EHREndpoint() {
    exists(string url |
      url = this.getStringValue() and
      (
        url.matches("%/fhir/%") or
        url.matches("%/ehr/%") or
        url.matches("%/api/v%") or
        url.matches("%/epic/%") or
        url.matches("%/cerner/%") or
        url.matches("%/allscripts/%")
      )
    )
  }
}

class InsecureEHRConfig extends TaintTracking::Configuration {
  InsecureEHRConfig() { this = "InsecureEHRConfig" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof EHRCredentialSource
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      call.getCalleeName().matches("%log%") and
      sink = call.getAnArgument()
    )
    or
    exists(DataFlow::PropWrite write |
      write.getPropertyName().matches("%url%") and
      sink = write.getRhs()
    )
  }
}

class UnsafeEHRAccess extends TaintTracking::Configuration {
  UnsafeEHRAccess() { this = "UnsafeEHRAccess" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof RemoteFlowSource
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(DataFlow::CallNode call |
      (
        call.getCalleeName().matches("%request%") or
        call.getCalleeName().matches("%fetch%") or
        call.getCalleeName().matches("%axios%")
      ) and
      sink = call.getAnArgument() and
      any(EHREndpoint endpoint).flowsTo(call.getAnArgument())
    )
  }
}

from DataFlow::PathNode source, DataFlow::PathNode sink, TaintTracking::Configuration config
where
  (
    config instanceof InsecureEHRConfig or
    config instanceof UnsafeEHRAccess
  ) and
  config.hasFlowPath(source, sink)
select sink.getNode(), source, sink, "Potential EHR security issue: $@ flows to $@.",
  source.getNode(), "Sensitive data", sink.getNode(), "dangerous sink"
