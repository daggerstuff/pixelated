/**
 * @name Insecure EHR Logging (Python)
 * @description Detects potential logging of sensitive EHR data in Python
 * @kind problem
 * @problem.severity warning
 * @security-severity 6.0
 * @precision high
 * @id py/insecure-ehr-logging
 * @tags security
 *       hipaa
 *       ehr
 */

import python
import semmle.python.dataflow.new.DataFlow
import semmle.python.dataflow.new.TaintTracking

predicate isEHRSensitiveData(DataFlow::Node node) {
  exists(string name |
    name = node.asExpr().(Name).getId().toLowerCase() or
    name = node.asExpr().(Attribute).getName().toLowerCase()
  |
    name.matches("%patient%") or
    name.matches("%health%") or
    name.matches("%record%") or
    name.matches("%ehr%") or
    name.matches("%fhir%")
  )
}

predicate isLoggingSink(DataFlow::Node sink) {
  exists(Call call |
    call.getFunc().(Attribute).getName().matches("%log%") or
    call.getFunc().(Attribute).getName().matches("%debug%") or
    call.getFunc().(Attribute).getName().matches("%info%") or
    call.getFunc().(Attribute).getName().matches("%warn%") or
    call.getFunc().(Attribute).getName().matches("%error%") or
    call.getFunc().(Attribute).getName().matches("%critical%")
  |
    sink.asExpr() = call.getAnArg()
  )
}

from DataFlow::Node source, DataFlow::Node sink
where
  isEHRSensitiveData(source) and
  isLoggingSink(sink) and
  TaintTracking::localTaint(source, sink)
select sink, "Potential leakage of sensitive EHR data in logs."
