#!/usr/bin/env node

/**
 * Script to create Jira issues for Auth0 migration with enhanced features
 *
 * Usage: node create-auth0-enhanced-jira-issues.js [project-key]
 *
 * Make sure to set the following environment variables:
 * JIRA_URL=https://your-domain.atlassian.net
 * JIRA_USERNAME=your-email@example.com
 * JIRA_API_TOKEN=your-api-token
 */

import https from 'https';
import process from 'process';

// Get environment variables
const JIRA_URL = process.env.JIRA_URL || 'https://pixeldeck.atlassian.net';
const JIRA_USERNAME = process.env.JIRA_USERNAME || 'chad@pixelatedempathy.com';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// Check if required environment variables are set
if (!JIRA_API_TOKEN) {
  console.error('Error: JIRA_API_TOKEN environment variable is required');
  console.error('Please set the JIRA_API_TOKEN environment variable and try again');
  process.exit(1);
}

// Get project key from command line argument or default to "PIX"
const PROJECT_KEY = process.argv[2] || 'PIX';

// Create authentication header
const authHeader = 'Basic ' + Buffer.from(`${JIRA_USERNAME}:${JIRA_API_TOKEN}`).toString('base64');

// Function to make HTTP requests
function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(jsonData);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${jsonData.errorMessages ? jsonData.errorMessages.join(', ') : data}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Epic data - Enhanced version
const epicData = {
  fields: {
    project: {
      key: PROJECT_KEY
    },
    summary: "Enhanced Auth0 Authentication System with Advanced Security and Usability Features",
    description: {
      version: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Enhance the Auth0 authentication system with comprehensive security features, usability improvements, and modern UI design to provide enterprise-grade authentication for the Pixelated Empathy platform."
            }
          ]
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Building upon the successful migration from better-auth to Auth0, this epic will implement advanced security features, streamlined user experience, and comprehensive monitoring capabilities to create the most robust authentication system possible for a healthcare application."
            }
          ]
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Advanced security features (session management, device tracking, brute force protection)"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Streamlined authentication flows with progressive profiling and intelligent MFA"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Modern, accessible UI with enhanced visual feedback"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Comprehensive analytics and monitoring capabilities"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Advanced MFA options (TOTP, SMS, WebAuthn, adaptive authentication)"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "User impersonation with audit logging"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Data management with soft delete and retention policies"
                    }
                  ]
                }
              ]
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Real-time activity tracking and security event processing"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    issuetype: {
      name: "Epic"
    }
    // Removed customfield_10011 as it's not available in this Jira instance
  }
};

// Enhanced stories data including original migration and new enhancement stories
const stories = [
  // Original migration stories
  {
    key: "PIX-1248",
    summary: "Auth0 Account Setup and Configuration",
    description: "Set up Auth0 tenant and configure for HIPAA compliance requirements.",
    points: 3,
    tasks: [
      "Create Auth0 tenant for Pixelated Empathy",
      "Configure tenant settings for HIPAA compliance",
      "Set up custom domain for branding consistency",
      "Configure email provider for verification emails",
      "Enable necessary Auth0 features for healthcare compliance"
    ]
  },
  {
    key: "PIX-1249",
    summary: "User Migration Planning and Data Analysis",
    description: "Analyze existing user data and plan migration strategy from MongoDB to Auth0.",
    points: 5,
    tasks: [
      "Export existing users from MongoDB database",
      "Analyze user data structure and roles",
      "Identify data transformation requirements",
      "Plan migration approach (bulk import vs. incremental)",
      "Create backup of MongoDB user collection"
    ]
  },
  {
    key: "PIX-1250",
    summary: "User Migration Implementation",
    description: "Implement scripts and processes to migrate existing users from MongoDB to Auth0.",
    points: 8,
    tasks: [
      "Develop user export script from MongoDB",
      "Create data transformation scripts for Auth0 format",
      "Implement user import to Auth0 using Management API",
      "Preserve user roles and permissions during migration",
      "Handle password migration (users may need to reset)"
    ]
  },
  {
    key: "PIX-1251",
    summary: "Auth0 SDK Integration",
    description: "Replace better-auth with Auth0 Node.js SDK in authentication service.",
    points: 8,
    tasks: [
      "Install Auth0 Node.js SDK: @auth0/auth0-node",
      "Replace better-auth initialization with Auth0 client",
      "Update authentication service methods: User registration, User login/logout, Password reset, Token refresh",
      "Implement session management with Auth0 sessions"
    ]
  },
  {
    key: "PIX-1252",
    summary: "JWT Token Handling Update",
    description: "Update JWT token handling to use Auth0 tokens instead of custom implementation.",
    points: 5,
    tasks: [
      "Replace custom JWT service with Auth0 tokens",
      "Update token validation to use Auth0 public keys",
      "Configure token expiration and refresh settings",
      "Implement token revocation using Auth0 APIs",
      "Update client-side token handling"
    ]
  },
  {
    key: "PIX-1253",
    summary: "Role-Based Access Control Implementation",
    description: "Implement role-based access control using Auth0 roles and permissions.",
    points: 8,
    tasks: [
      "Create roles in Auth0: admin, therapist, patient, researcher, guest",
      "Map existing user roles to Auth0 roles",
      "Configure role-based authorization rules",
      "Set up role persistence in JWT tokens",
      "Update middleware to enforce role-based access"
    ]
  },
  {
    key: "PIX-1254",
    summary: "Social Authentication Implementation",
    description: "Configure and implement social authentication (Google OAuth) using Auth0.",
    points: 5,
    tasks: [
      "Configure Google OAuth in Auth0 dashboard",
      "Set up Google credentials and redirect URIs",
      "Update client-side authentication flows",
      "Handle existing social login users during migration",
      "Test social authentication flows"
    ]
  },
  {
    key: "PIX-1255",
    summary: "Middleware and API Protection Updates",
    description: "Update authentication middleware and API protection to use Auth0 context.",
    points: 8,
    tasks: [
      "Replace authentication middleware with Auth0 middleware",
      "Update authorization middleware to use Auth0 roles",
      "Implement device binding and session security",
      "Add security event logging for Auth0 events",
      "Configure API protection with Auth0"
    ]
  },
  {
    key: "PIX-1256",
    summary: "Testing and Validation",
    description: "Comprehensive testing of all authentication flows and security features.",
    points: 13,
    tasks: [
      "Test all authentication flows (login, registration, password reset)",
      "Validate role-based access control",
      "Test social authentication",
      "Verify token handling and refresh",
      "Conduct security testing and penetration testing",
      "Performance testing under load",
      "User acceptance testing"
    ]
  },
  {
    key: "PIX-1257",
    summary: "Deployment and Monitoring",
    description: "Deploy Auth0 authentication to production and implement monitoring.",
    points: 8,
    tasks: [
      "Deploy to staging environment first",
      "Monitor for authentication issues",
      "Gradual rollout to production",
      "Implement monitoring and alerting",
      "Update documentation",
      "Train team on new system"
    ]
  },
  // New enhancement stories
  {
    key: "PIX-2001",
    summary: "Consolidate Authentication Systems",
    description: "Fully migrate all authentication to the new Auth0 system to eliminate security inconsistencies and simplify maintenance.",
    points: 8,
    tasks: [
      "Audit all API routes to identify those still using legacy MongoDB/JWT authentication",
      "Update remaining API routes to use Auth0 authentication middleware",
      "Remove legacy authentication service files",
      "Update all client-side authentication calls to use Auth0",
      "Test complete authentication flow across all application features",
      "Remove better-auth dependencies from package.json",
      "Update documentation to reflect consolidated authentication system"
    ]
  },
  {
    key: "PIX-2002",
    summary: "Enhanced Security Features Implementation",
    description: "Implement advanced security features including session management, device tracking, rate limiting, and brute force protection.",
    points: 13,
    tasks: [
      "Implement session invalidation across devices when password is changed",
      "Add device registration/tracking with ability to revoke specific devices",
      "Implement rate limiting for authentication endpoints",
      "Add account lockout mechanisms after failed attempts",
      "Implement session timeout and automatic logout",
      "Add IP address tracking and suspicious activity alerts",
      "Implement security question functionality for account recovery",
      "Add security event logging for all authentication activities"
    ]
  },
  {
    key: "PIX-2003",
    summary: "Advanced User Management Features",
    description: "Implement self-service profile management, password history, email verification, and account recovery mechanisms.",
    points: 8,
    tasks: [
      "Create user profile management interface",
      "Implement password history to prevent reuse of previous passwords",
      "Strengthen email verification flows with resend functionality",
      "Implement secure account recovery mechanisms",
      "Add user preference management (notifications, privacy settings)",
      "Implement user data export functionality (GDPR compliance)",
      "Add user deactivation/reactivation capabilities",
      "Create administrative user management dashboard"
    ]
  },
  {
    key: "PIX-2004",
    summary: "Advanced Analytics and Monitoring",
    description: "Implement comprehensive analytics for user behavior, authentication funnels, and MFA adoption tracking.",
    points: 8,
    tasks: [
      "Implement user behavior analytics (login patterns, device usage, geographic access)",
      "Create authentication funnel analysis to monitor drop-off points",
      "Implement MFA adoption tracking and reporting",
      "Add security incident tracking and reporting",
      "Create dashboard for authentication metrics and KPIs",
      "Implement real-time monitoring alerts for suspicious activities",
      "Add performance metrics tracking for authentication flows",
      "Create automated reporting for security and usage analytics"
    ]
  },
  {
    key: "PIX-2005",
    summary: "Streamlined Authentication Flows",
    description: "Implement progressive profiling, intelligent MFA selection, remember device functionality, and improved error handling.",
    points: 13,
    tasks: [
      "Implement progressive profiling to collect user information gradually",
      "Create intelligent MFA selection based on risk and user preferences",
      "Add \"remember this device\" functionality to reduce MFA prompts",
      "Implement graceful error handling with actionable steps",
      "Create single sign-on (SSO) capabilities for enterprise users",
      "Expand passwordless options beyond WebAuthn",
      "Implement social account linking for multiple providers",
      "Add printable backup codes for MFA recovery"
    ]
  },
  {
    key: "PIX-2006",
    summary: "Accessibility Improvements",
    description: "Ensure all authentication flows are accessible to users with disabilities.",
    points: 5,
    tasks: [
      "Implement screen reader support for all authentication flows",
      "Improve keyboard navigation for all authentication components",
      "Ensure sufficient contrast ratios for visually impaired users",
      "Add language localization support for multiple languages",
      "Implement ARIA labels and landmarks for accessibility",
      "Add skip navigation links for keyboard users",
      "Test with accessibility tools (axe, WAVE, etc.)",
      "Conduct user testing with accessibility experts"
    ]
  },
  {
    key: "PIX-2007",
    summary: "Modern UI Design Implementation",
    description: "Implement a modern, responsive design for all authentication pages with improved visual feedback.",
    points: 13,
    tasks: [
      "Ensure all authentication pages follow brand guidelines",
      "Implement responsive design for all device sizes (mobile, tablet, desktop)",
      "Add skeleton screens and loading indicators",
      "Implement subtle animations for better user feedback",
      "Create customizable themes (light/dark mode)",
      "Improve form design with better input fields, validation, and error display",
      "Modernize social login buttons with consistent styling",
      "Create clear MFA selection screen with intuitive interface"
    ]
  },
  {
    key: "PIX-2008",
    summary: "Enhanced Visual Feedback and User Experience",
    description: "Add progress indicators, success/error states, security status, and session information displays.",
    points: 8,
    tasks: [
      "Show progress in multi-step authentication flows",
      "Implement clear visual feedback for authentication outcomes",
      "Add visual indicators for account security level",
      "Display active sessions with device/location details",
      "Create security dashboard for users to monitor their account",
      "Add password strength indicators during registration/reset",
      "Implement real-time validation for form inputs",
      "Add tooltips and help text for complex authentication features"
    ]
  },
  {
    key: "PIX-2009",
    summary: "Advanced MFA Implementation",
    description: "Implement comprehensive MFA features including TOTP, SMS, WebAuthn, and adaptive authentication.",
    points: 13,
    tasks: [
      "Implement TOTP-based MFA using Auth0 Guardian",
      "Add SMS-based MFA as backup option",
      "Implement WebAuthn/FIDO2 support for passwordless authentication",
      "Create adaptive MFA with risk-based triggers",
      "Add biometric authentication support (fingerprint, face recognition)",
      "Implement push notification MFA",
      "Create MFA enrollment and management interface",
      "Add MFA recovery options and backup codes"
    ]
  },
  {
    key: "PIX-2010",
    summary: "User Impersonation and Administrative Features",
    description: "Implement secure user impersonation with comprehensive audit logging and administrative capabilities.",
    points: 8,
    tasks: [
      "Implement secure user impersonation functionality",
      "Add comprehensive audit logging for impersonation sessions",
      "Create impersonation session management and termination",
      "Implement administrative user impersonation controls",
      "Add impersonation activity monitoring and alerts",
      "Create impersonation reporting and analytics",
      "Implement impersonation permission controls and restrictions",
      "Add impersonation session timeout and automatic termination"
    ]
  },
  {
    key: "PIX-2011",
    summary: "Data Management and Privacy Features",
    description: "Implement soft delete functionality, bulk import/export, and data retention policies.",
    points: 8,
    tasks: [
      "Implement soft delete functionality with configurable data retention policies",
      "Create bulk user import/export capabilities for administrators",
      "Implement data archiving and purge scheduling",
      "Add GDPR-compliant data deletion functionality",
      "Create data retention policy management interface",
      "Implement audit trails for all data modifications",
      "Add data export functionality for user requests",
      "Create data anonymization tools for testing environments"
    ]
  },
  {
    key: "PIX-2012",
    summary: "Real-time Activity Tracking and Monitoring",
    description: "Implement real-time user activity tracking with Auth0 Logs API and security event processing.",
    points: 8,
    tasks: [
      "Implement real-time user activity tracking using Auth0 Logs API",
      "Create security event processing from Auth0 logs",
      "Implement user activity summaries and reporting",
      "Add real-time activity stream for administrators",
      "Create security event alerts and notifications",
      "Implement user session information and management",
      "Add activity statistics and analytics",
      "Create activity search and filtering capabilities"
    ]
  },
  {
    key: "PIX-2013",
    summary: "Comprehensive Testing and Validation",
    description: "Perform comprehensive testing of all enhanced authentication flows and security features.",
    points: 13,
    tasks: [
      "Test all authentication flows (login, registration, password reset)",
      "Validate role-based access control with enhanced permissions",
      "Test social authentication with multiple providers",
      "Verify token handling and refresh with enhanced security",
      "Conduct security testing and penetration testing",
      "Performance testing under load with enhanced features",
      "User acceptance testing for all new UI elements",
      "Accessibility testing for all new components",
      "Cross-browser and cross-device compatibility testing",
      "Security compliance validation (HIPAA, GDPR, etc.)"
    ]
  },
  {
    key: "PIX-2014",
    summary: "Documentation and Training",
    description: "Create comprehensive documentation and training materials for the enhanced authentication system.",
    points: 5,
    tasks: [
      "Update technical documentation for all new features",
      "Create user guides for enhanced authentication flows",
      "Develop administrator documentation for new capabilities",
      "Create training materials for end users",
      "Develop security documentation and best practices",
      "Create API documentation for new authentication endpoints",
      "Update deployment and maintenance documentation",
      "Create troubleshooting guides for new features"
    ]
  },
  {
    key: "PIX-2015",
    summary: "Deployment and Monitoring",
    description: "Deploy enhanced authentication features to production and implement comprehensive monitoring.",
    points: 8,
    tasks: [
      "Deploy to staging environment first for testing",
      "Monitor for authentication issues with enhanced features",
      "Gradual rollout to production with feature flags",
      "Implement monitoring and alerting for new capabilities",
      "Update documentation with deployment procedures",
      "Train team on new system features and capabilities",
      "Create rollback procedures for enhanced features",
      "Monitor performance and user feedback post-deployment"
    ]
  }
];

async function createIssues() {
  try {
    console.log('Creating Jira issues for Enhanced Auth0 migration...');

    // Create Epic
    console.log('Creating Epic...');
    const epicOptions = {
      hostname: JIRA_URL.replace('https://', '').replace('/', ''),
      port: 443,
      path: '/rest/api/3/issue',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const epicResponse = await makeRequest(epicOptions, JSON.stringify(epicData));
    const epicKey = epicResponse.key;
    console.log(`Created Epic: ${epicKey}`);

    // Create Stories
    for (const story of stories) {
      console.log(`Creating Story: ${story.key}...`);

      const storyData = {
        fields: {
          project: {
            key: PROJECT_KEY
          },
          summary: story.summary,
          description: {
            version: 1,
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: story.description
                  }
                ]
              },
              {
                type: "heading",
                attrs: {
                  level: 3
                },
                content: [
                  {
                    type: "text",
                    text: "Tasks"
                  }
                ]
              },
              {
                type: "bulletList",
                content: story.tasks.map(task => ({
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: task
                        }
                      ]
                    }
                  ]
                }))
              }
            ]
          },
          issuetype: {
            name: "Story"
          }
          // Removed customfield_10014 (Epic Link) and customfield_10016 (Story Points)
          // as they're not available in this Jira instance
        }
      };

      const storyOptions = {
        hostname: JIRA_URL.replace('https://', '').replace('/', ''),
        port: 443,
        path: '/rest/api/3/issue',
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      try {
        const storyResponse = await makeRequest(storyOptions, JSON.stringify(storyData));
        console.log(`Created Story: ${storyResponse.key}`);
      } catch (error) {
        console.error(`Failed to create story ${story.key}:`, error.message);
      }
    }

    console.log('Jira issue creation completed!');
    console.log(`Epic: ${epicKey}`);
    console.log('Stories: PIX-1248 through PIX-1257 (original migration) and PIX-2001 through PIX-2015 (enhancements)');

  } catch (error) {
    console.error('Error creating Jira issues:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createIssues();
}

export { createIssues };