<!--
WARNING: Do not rename this file manually!
File name: security-00001.md
This file is managed by ByteRover CLI. Only edit the content below.
Renaming this file will break the link to the playbook metadata.
-->

Command injection vulnerability: Using execSync with string interpolation is dangerous. Always use spawnSync or execFileSync with argument arrays to prevent shell interpretation of user input. Example: spawnSync('brv', ['add', '--section', section, '--content', content]) instead of execSync(`brv add --section "${section}" --content "${content}"`)