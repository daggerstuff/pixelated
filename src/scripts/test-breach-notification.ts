#!/usr/bin/env tsx

import { Command } from 'commander'
import { BreachNotificationSystem } from '../lib/security/breach-notification'
import { logger } from '../lib/logger'
import dotenv from 'dotenv'
import chalk from 'chalk'

// Load environment variables
dotenv.config()

const program = new Command()

program
  .name('test-breach-notification')
  .description('Test the security breach notification system')
  .version('1.0.0')

program
  .command('test')
  .description('Run a test breach notification scenario')
  .option('-t, --type <type>', 'Breach type', 'unauthorized_access')
  .option('-s, --severity <severity>', 'Breach severity', 'medium')
  .option('-u, --users <count>', 'Number of affected users', '5')
  .action(
    async (options: { type: string; severity: string; users: string }) => {
      try {
        const type = options.type as
          | 'unauthorized_access'
          | 'data_leak'
          | 'system_compromise'
          | 'other'
        const severity = options.severity as
          | 'low'
          | 'medium'
          | 'high'
          | 'critical'
        const users = parseInt(options.users, 10)

        console.log(chalk.blue('\n📋 Running test breach notification:'))
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
        console.log(`- Type: ${chalk.yellow(type)}`)
        console.log(`- Severity: ${getSeverityColor(severity)(severity)}`)
        console.log(`- Affected Users: ${chalk.yellow(users.toString())}`)
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'))

        // Add warning for high/critical severity
        if (severity === 'high' || severity === 'critical') {
          console.log(
            chalk.yellow(
              '⚠️  Note: This will send actual test notifications to Slack',
            ),
          )
          const confirm = await promptForConfirmation('Continue with test?')
          if (!confirm) {
            console.log(chalk.gray('Test cancelled'))
            process.exit(0)
          }
        }

        const breachId = await BreachNotificationSystem.runTestScenario({
          type,
          severity,
          affectedUsers: users,
        })

        console.log(
          chalk.green(
            `\n✅ Test breach reported with ID: ${chalk.bold(breachId)}`,
          ),
        )

        if (severity === 'high' || severity === 'critical') {
          console.log(
            chalk.yellow('\nCheck your Slack channel for test notifications'),
          )
        } else {
          console.log(
            chalk.gray(
              "\nNote: Low/medium severity tests don't send Slack notifications by default",
            ),
          )
        }

        console.log(chalk.blue('\nTo check status of this test breach:'))
        console.log(chalk.gray(`pnpm security:breach-status ${breachId}`))
      } catch (error) {
        logger.error('Failed to run test breach notification:', error)
        process.exit(1)
      }
    },
  )

program
  .command('real')
  .description('Report a real breach notification (USE WITH CAUTION)')
  .option('-t, --type <type>', 'Breach type', 'unauthorized_access')
  .option('-s, --severity <severity>', 'Breach severity', 'high')
  .option(
    '-d, --description <text>',
    'Breach description',
    'Security breach detected',
  )
  .option(
    '-a, --affected-data <items>',
    'Affected data (comma separated)',
    'user_data',
  )
  .option(
    '-u, --users <ids>',
    'Affected user IDs (comma separated)',
    'user_1,user_2',
  )
  .option('-m, --detection <method>', 'Detection method', 'security monitoring')
  .option(
    '-r, --remediation <steps>',
    'Remediation steps',
    'System secured, investigation ongoing',
  )
  .action(
    async (options: {
      'type': string
      'severity': string
      'description': string
      'affected-data': string
      'users': string
      'detection': string
      'remediation': string
    }) => {
      try {
        console.log(chalk.red('\n🚨 REPORTING A REAL BREACH NOTIFICATION 🚨\n'))
        console.log(chalk.yellow('This will trigger ACTUAL notifications to:'))
        console.log(
          chalk.yellow('- Slack channels (configured via SLACK_WEBHOOK)'),
        )
        console.log(
          chalk.yellow('- Email recipients defined in SECURITY_STAKEHOLDERS'),
        )
        console.log(
          chalk.yellow('- Affected users (if they exist in the system)'),
        )

        const userCount = options.users.split(',').length
        if (options.severity === 'critical' || userCount >= 500) {
          console.log(
            chalk.red(
              '- Authorities (HHS) since breach affects 500+ users or is critical severity',
            ),
          )
        }

        type BreachSeverity = 'low' | 'medium' | 'high' | 'critical'

        console.log(chalk.blue('\nBreak details:'))
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
        console.log(`- Type: ${chalk.yellow(options.type)}`)
        console.log(
          `- Severity: ${getSeverityColor(options.severity as BreachSeverity)(options.severity)}`,
        )
        console.log(`- Affected Users: ${chalk.yellow(userCount.toString())}`)
        console.log(`- Description: ${chalk.gray(options.description)}`)
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'))

        const confirm = await promptForConfirmation(
          'Are you ABSOLUTELY SURE you want to proceed?',
        )

        if (!confirm) {
          console.log(chalk.gray('Operation cancelled'))
          process.exit(0)
        }

        // Double-confirm for critical severity
        if (options.severity === 'critical') {
          console.log(chalk.red('\n⚠️  CRITICAL SEVERITY WARNING ⚠️'))
          console.log(
            chalk.red('This will initiate emergency response protocols'),
          )
          const doubleConfirm = await promptForConfirmation(
            'Confirm you want to proceed with CRITICAL severity?',
          )

          if (!doubleConfirm) {
            console.log(chalk.gray('Operation cancelled'))
            process.exit(0)
          }
        }

        const breachId = await BreachNotificationSystem.reportBreach({
          type: options.type as
            | 'unauthorized_access'
            | 'data_leak'
            | 'system_compromise'
            | 'other',
          severity: options.severity as 'low' | 'medium' | 'high' | 'critical',
          description: options.description,
          affectedUsers: options.users.split(','),
          affectedData: options['affected-data'].split(','),
          detectionMethod: options.detection,
          remediation: options.remediation,
        })

        console.log(
          chalk.green(
            `\n✅ Real breach reported with ID: ${chalk.bold(breachId)}`,
          ),
        )
        console.log(chalk.yellow('Notification process has been initiated'))
        console.log(chalk.blue('\nTo check status of this breach:'))
        console.log(chalk.gray(`pnpm security:breach-status ${breachId}`))
      } catch (error) {
        logger.error('Failed to report breach:', error)
        process.exit(1)
      }
    },
  )

program
  .command('list')
  .description('List recent breach notifications')
  .option('-l, --limit <count>', 'Number of breaches to show', '10')
  .action(async (options: { limit: string }) => {
    try {
      const breaches = await BreachNotificationSystem.listRecentBreaches()

      if (breaches.length === 0) {
        console.log(chalk.yellow('No recent breaches found'))
        return
      }

      const limit = Math.min(parseInt(options.limit, 10), breaches.length)
      console.log(
        chalk.blue(
          `\n📋 Found ${breaches.length} recent breaches (showing ${limit}):\n`,
        ),
      )
      console.log(
        chalk.blue(
          '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
        ),
      )

      breaches.slice(0, limit).forEach((breach, index) => {
        const severityColor = getSeverityColor(breach.severity)

        console.log(`${index + 1}. ID: ${chalk.bold(breach.id)}`)
        console.log(`   Type: ${chalk.yellow(breach.type)}`)
        console.log(`   Severity: ${severityColor(breach.severity)}`)
        console.log(
          `   Status: ${getStatusColor(breach.notificationStatus)(breach.notificationStatus)}`,
        )
        console.log(
          `   Time: ${chalk.gray(new Date(breach.timestamp).toLocaleString())}`,
        )
        console.log(
          `   Affected Users: ${chalk.yellow(breach.affectedUsers.length.toString())}`,
        )
        console.log(
          `   Description: ${chalk.gray(breach.description.substring(0, 100))}${breach.description.length > 100 ? '...' : ''}`,
        )
        console.log(
          chalk.blue(
            '───────────────────────────────────────────────────────────────────────────────',
          ),
        )
      })

      console.log(chalk.blue('\nTo view details of a specific breach:'))
      console.log(chalk.gray('pnpm security:breach-status <breach-id>'))
    } catch (error) {
      logger.error('Failed to list breaches:', error)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Get status of a specific breach notification')
  .argument('<id>', 'Breach notification ID')
  .action(async (id: string) => {
    try {
      const breach = await BreachNotificationSystem.getBreachStatus(id)

      if (!breach) {
        console.log(chalk.yellow(`\n⚠️ No breach found with ID: ${id}`))
        return
      }

      const severityColor = getSeverityColor(breach.severity)
      const statusColor = getStatusColor(breach.notificationStatus)

      console.log(chalk.blue('\n📋 Breach Notification Details:'))
      console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
      console.log(`ID: ${chalk.bold(breach.id)}`)
      console.log(`Type: ${chalk.yellow(breach.type)}`)
      console.log(`Severity: ${severityColor(breach.severity)}`)
      console.log(`Status: ${statusColor(breach.notificationStatus)}`)
      console.log(
        `Time: ${chalk.gray(new Date(breach.timestamp).toLocaleString())}`,
      )
      console.log(
        `Affected Users: ${chalk.yellow(breach.affectedUsers.length.toString())}`,
      )
      console.log(`Description: ${chalk.gray(breach.description)}`)
      console.log(
        `Affected Data: ${chalk.yellow(breach.affectedData.join(', '))}`,
      )
      console.log(`Detection Method: ${chalk.gray(breach.detectionMethod)}`)
      console.log(`Remediation: ${chalk.gray(breach.remediation)}`)
      console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    } catch (error) {
      logger.error('Failed to get breach status:', error)
      process.exit(1)
    }
  })

function getSeverityColor(severity: 'low' | 'medium' | 'high' | 'critical') {
  switch (severity) {
    case 'critical':
      return chalk.red.bold
    case 'high':
      return chalk.redBright
    case 'medium':
      return chalk.yellow
    case 'low':
      return chalk.green
    default:
      return chalk.gray
  }
}

function getStatusColor(status: 'pending' | 'in_progress' | 'completed') {
  switch (status) {
    case 'pending':
      return chalk.yellow
    case 'in_progress':
      return chalk.blue
    case 'completed':
      return chalk.green
    default:
      return chalk.gray
  }
}

async function promptForConfirmation(message: string): Promise<boolean> {
  process.stdout.write(chalk.yellow(`${message} (y/N) `))

  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const response = data.toString().trim().toLowerCase()
      resolve(response === 'y' || response === 'yes')
    })
  })
}

program.parse(process.argv)
