import sys

file_path = 'src/lib/security/backup/index.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Fix importKey calls
content = content.replace("key,", "key as any,")
# Fix encrypt/decrypt calls
content = content.replace("data,", "data as any,")
content = content.replace("combinedBuffer,", "combinedBuffer as any,")

with open(file_path, 'w') as f:
    f.write(content)

# Update mongodb.dao.ts to be more Rollup-friendly
file_path_dao = 'src/services/mongodb.dao.ts'
with open(file_path_dao, 'r') as f:
    lines = f.readlines()

# Find the allDAOs definition and move it around if needed,
# but let's just make sure it's clean.
# I'll just rewrite the end of the file to be sure.

new_end = """
// Export instances for use throughout the application
export const todoDAO = new TodoDAO()
export const aiMetricsDAO = new AIMetricsDAO()
export const biasDetectionDAO = new BiasDetectionDAO()
export const treatmentPlanDAO = new TreatmentPlanDAO()
export const crisisSessionFlagDAO = new CrisisSessionFlagDAO()
export const consentManagementDAO = new ConsentManagementDAO()
export const dataExportDAO = new DataExportDAO()
export const userDAO = new UserDAO()
export const sessionDAO = new SessionDAO()

// DAO Registry for system-wide operations
export const allDAOs: Record<string, any> = {
  todos: todoDAO,
  aiMetrics: aiMetricsDAO,
  biasDetection: biasDetectionDAO,
  treatmentPlans: treatmentPlanDAO,
  crisisSessionFlags: crisisSessionFlagDAO,
  consentManagement: consentManagementDAO,
  dataExports: dataExportDAO,
  users: userDAO,
  sessions: sessionDAO,
}
"""

# Find where the exports start
for i, line in enumerate(lines):
    if "export const todoDAO = new TodoDAO()" in line:
        lines = lines[:i]
        break

with open(file_path_dao, 'w') as f:
    f.writelines(lines)
    f.write(new_end)
