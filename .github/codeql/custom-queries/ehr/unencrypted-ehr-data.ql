/**
 * @name Unencrypted EHR Data Transfer
 * @kind problem
 * @id js/unencrypted-ehr-data
 * @tags security hipaa ehr
 */
import javascript
from CallExpr call, DataFlow::Node data
where exists(string n | n = call.getCalleeName() and (n.matches("%http%") or n.matches("%fetch%") or n.matches("%axios%") or n.matches("%request%")))
  and exists(string name | name = data.asExpr().toString().toLowerCase() and (name.matches("%patient%") or name.matches("%health%") or name.matches("%record%") or name.matches("%ehr%")))
  and not exists(CallExpr enc | enc.getCalleeName().matches("%encrypt%") and DataFlow::localFlow(data, DataFlow::exprNode(enc.getAnArgument())))
select call, "Potential unencrypted EHR data transmission detected."
