<!--
WARNING: Do not rename this file manually!
File name: security-00010.md
This file is managed by ByteRover CLI. Only edit the content below.
Renaming this file will break the link to the playbook metadata.
-->

Security event logger provides HIPAA-compliant audit trail with 30+ event types. Events stored in Redis with 7-year retention (2555 days). Implements event buffering (batch size 100), automatic flushing (60s interval), risk scoring (0-1), and PHI sanitization. High-risk events (score>=0.7) trigger immediate alerts. Supports real-time monitoring, compliance reporting, and suspicious pattern detection.