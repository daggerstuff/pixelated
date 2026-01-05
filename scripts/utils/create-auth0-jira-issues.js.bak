#!/usr/bin/env node

/**
 * Script to create Jira issues for Auth0 migration
 *
 * Usage: node create-auth0-jira-issues.js [project-key]
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

// Epic data
const epicData = {
  fields: {
    project: {
      key: PROJECT_KEY
    },
    summary: "Migrate Authentication System from Better-Auth to Auth0",
    description: {
      version: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Replace the current better-auth authentication system with Auth0 to provide enterprise-grade security, HIPAA compliance, and professional authentication features for the Pixelated Empathy platform."
            }
          ]
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "The Pixelated Empathy platform currently uses better-auth for authentication, which lacks the enterprise features and comprehensive compliance capabilities required for a healthcare application. This epic will migrate the authentication system to Auth0, providing:"
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
                      text: "HIPAA-compliant authentication with Business Associate Agreement (BAA)"
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
                      text: "Enterprise-grade security features (MFA, anomaly detection, threat protection)"
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
                      text: "Professional user management and audit logging"
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
                      text: "Scalable authentication infrastructure"
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
                      text: "Improved developer experience with mature SDKs"
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

// Stories data
const stories = [
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
  }
];

async function createIssues() {
  try {
    console.log('Creating Jira issues for Auth0 migration...');

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
    console.log('Stories: PIX-1248 through PIX-1257');

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