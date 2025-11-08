<!--
WARNING: Do not rename this file manually!
File name: common-00013.md
This file is managed by ByteRover CLI. Only edit the content below.
Renaming this file will break the link to the playbook metadata.
-->

Role transition workflow requires: 1) 2FA verification before request, 2) Approval from higher-role user, 3) Security review for sensitive transitions (patient->admin), 4) Audit trail logging. Common mistake: allowing self-approval or skipping 2FA. Always check validateRoleTransition() returns requiresApproval=true and requiresMFA=true for elevation requests.