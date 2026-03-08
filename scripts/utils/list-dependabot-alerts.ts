#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';

async function main() {
  try {
    // Get the current repository owner and name using gh cli
    console.log('Fetching repository information...');
    const repoInfo = execSync('gh repo view --json owner,name', { encoding: 'utf-8' });
    const { owner, name } = JSON.parse(repoInfo);

    // Call the GitHub Dependabot alerts API
    console.log(`Fetching Dependabot alerts for ${owner.login}/${name}...`);
    const alertsJson = execSync(`gh api repos/${owner.login}/${name}/dependabot/alerts`, { encoding: 'utf-8' });

    // Validate JSON
    let alertsData: any;
    try {
      alertsData = JSON.parse(alertsJson);
    } catch (parseError) {
      console.error('Error: Invalid JSON response from GitHub API');
      process.exit(1);
    }

    // Write to alerts.json
    fs.writeFileSync('alerts.json', JSON.stringify(alertsData, null, 2));

    console.log(`Successfully wrote ${Array.isArray(alertsData) ? alertsData.length : 'all'} Dependabot alerts to alerts.json`);

  } catch (error) {
    console.error('Error fetching Dependabot alerts:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();