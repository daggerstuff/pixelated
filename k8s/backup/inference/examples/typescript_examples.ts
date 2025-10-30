/**
 * Pixelated Empathy AI - TypeScript/JavaScript Client Usage Examples
 * Task 3A.3.4: API Usage Examples and Tutorials
 * 
 * Comprehensive examples demonstrating common use cases with the TypeScript client.
 * Compatible with both Node.js and browser environments.
 */

// Import the client library (adjust path as needed in production)
import {
  PixelatedEmpathyClient,
  AdvancedQuery,
  BulkExportRequest,
  QualityTier,
  ExportFormat,
  JobStatus,
  quickQuery,
  quickExport,
  PixelatedEmpathyError,
  RateLimitError,
  AuthenticationError
} from '../clients/typescript/src/index.js';

// Example 1: Basic Dataset Discovery
async function exampleBasicDiscovery(): Promise<void> {
  console.log("=== Example 1: Basic Dataset Discovery ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // List all available datasets
    const datasets = await client.listDatasets();
    console.log(`Found ${datasets.length} datasets:`);
    
    for (const dataset of datasets) {
      console.log(`  - ${dataset.name}: ${dataset.conversations.toLocaleString()} conversations`);
      console.log(`    Quality: ${dataset.quality_score.toFixed(3)}`);
      console.log(`    Tiers: ${dataset.tiers.join(', ')}`);
    }
    
    // Get detailed info for first dataset
    if (datasets.length > 0) {
      const firstDataset = datasets[0].name;
      const info = await client.getDatasetInfo(firstDataset);
      console.log(`\nDetailed info for '${firstDataset}':`);
      console.log(`  Last updated: ${info.statistics.last_updated}`);
      console.log(`  Tier distribution:`, info.statistics.tier_distribution);
    }
  } catch (error) {
    console.error('Dataset discovery error:', error);
  }
}

// Example 2: Advanced Conversation Querying
async function exampleAdvancedQuerying(): Promise<void> {
  console.log("\n=== Example 2: Advanced Conversation Querying ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // Query high-quality professional conversations
    const query: AdvancedQuery = {
      tier: QualityTier.PROFESSIONAL,
      min_quality: 0.8,
      min_therapeutic_accuracy: 0.75,
      min_safety_score: 0.9,
      created_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      sort_by: "quality_score",
      sort_order: "desc",
      limit: 20
    };
    
    const results = await client.queryConversations(query);
    const conversations = results.conversations || [];
    console.log(`Found ${conversations.length} high-quality conversations`);
    
    // Display first few results
    for (let i = 0; i < Math.min(3, conversations.length); i++) {
      const conv = conversations[i];
      console.log(`\nConversation ${i + 1}:`);
      console.log(`  ID: ${conv.id}`);
      console.log(`  Quality Score: ${conv.quality_score.toFixed(3)}`);
      console.log(`  Messages: ${conv.message_count}`);
      console.log(`  Dataset: ${conv.dataset || 'unknown'}`);
    }
  } catch (error) {
    console.error('Advanced querying error:', error);
  }
}

// Example 3: Content Search and Filtering
async function exampleContentSearch(): Promise<void> {
  console.log("\n=== Example 3: Content Search and Filtering ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // Search for conversations about anxiety
    const searchQuery: AdvancedQuery = {
      content_search: "anxiety depression",
      min_quality: 0.7,
      tier: QualityTier.PROFESSIONAL,
      min_messages: 5,
      limit: 10
    };
    
    const results = await client.queryConversations(searchQuery);
    const conversations = results.conversations || [];
    console.log(`Found ${conversations.length} conversations about anxiety/depression`);
    
    // Also use the search endpoint
    const searchResults = await client.searchConversations(
      "therapeutic intervention",
      { tier: "clinical", min_quality: 0.8 },
      5
    );
    
    const searchResultsList = searchResults.results || [];
    console.log(`Search endpoint found ${searchResultsList.length} therapeutic conversations`);
    
    for (let i = 0; i < Math.min(3, searchResultsList.length); i++) {
      const result = searchResultsList[i];
      console.log(`  - ${result.conversation_id}: ${result.relevance_score.toFixed(3)} relevance`);
    }
  } catch (error) {
    console.error('Content search error:', error);
  }
}

// Example 4: Bulk Export Operations
async function exampleBulkExport(): Promise<void> {
  console.log("\n=== Example 4: Bulk Export Operations ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // Create a filtered export job
    const exportRequest: BulkExportRequest = {
      dataset: "priority_complete_fixed",
      format: ExportFormat.JSONL,
      filters: {
        tier: QualityTier.PROFESSIONAL,
        min_quality: 0.8,
        limit: 1000
      },
      include_metadata: true,
      include_quality_metrics: true,
      notify_email: "researcher@example.com"
    };
    
    // Submit export job
    const jobId = await client.createBulkExport(exportRequest);
    console.log(`Created export job: ${jobId}`);
    
    // Check initial status
    const status = await client.getExportStatus(jobId);
    console.log(`Initial status: ${status.status} (${status.progress.toFixed(1)}%)`);
    
    // List recent export jobs
    const recentJobs = await client.listExportJobs(undefined, 5);
    console.log(`\nRecent export jobs (${recentJobs.length}):`);
    
    for (const job of recentJobs) {
      console.log(`  ${job.job_id}: ${job.status} (${job.progress.toFixed(1)}%)`);
    }
  } catch (error) {
    console.error('Bulk export error:', error);
  }
}

// Example 5: Quality Assessment and Validation
async function exampleQualityAssessment(): Promise<void> {
  console.log("\n=== Example 5: Quality Assessment and Validation ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // Get system-wide quality metrics
    const metrics = await client.getQualityMetrics();
    console.log("System-wide quality metrics:");
    console.log(`  Average quality: ${metrics.overall_statistics.average_quality.toFixed(3)}`);
    console.log(`  Total conversations: ${metrics.overall_statistics.total_conversations.toLocaleString()}`);
    
    // Get tier-specific metrics
    for (const [tier, data] of Object.entries(metrics.tier_metrics)) {
      console.log(`  ${tier.charAt(0).toUpperCase() + tier.slice(1)}: ${data.average_quality.toFixed(3)} (${data.count.toLocaleString()} conversations)`);
    }
    
    // Validate a sample conversation
    const sampleConversation = {
      id: "sample_001",
      messages: [
        {
          role: "user" as const,
          content: "I'm feeling overwhelmed with work stress.",
          timestamp: "2025-08-29T08:00:00Z"
        },
        {
          role: "assistant" as const,
          content: "I understand that work stress can feel overwhelming. Can you tell me more about what specifically is causing you the most stress right now?",
          timestamp: "2025-08-29T08:00:30Z"
        }
      ],
      quality_score: 0.85,
      tier: QualityTier.PROFESSIONAL,
      metadata: {},
      created_at: "2025-08-29T08:00:00Z"
    };
    
    const validation = await client.validateConversationQuality(sampleConversation);
    console.log(`\nValidation results for sample conversation:`);
    console.log(`  Overall quality: ${validation.validation_results.overall_quality.toFixed(3)}`);
    console.log(`  Tier classification: ${validation.tier_classification}`);
    console.log(`  Recommendations: ${validation.recommendations.length} suggestions`);
  } catch (error) {
    console.error('Quality assessment error:', error);
  }
}

// Example 6: Usage Monitoring and Analytics
async function exampleUsageMonitoring(): Promise<void> {
  console.log("\n=== Example 6: Usage Monitoring and Analytics ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // Get comprehensive usage statistics
    const usage = await client.getUsageStatistics();
    
    console.log("Your API usage statistics:");
    const userStats = usage.user_statistics;
    console.log(`  Total requests: ${userStats.total_requests.toLocaleString()}`);
    console.log(`  Requests today: ${userStats.requests_today.toLocaleString()}`);
    console.log(`  Account created: ${userStats.account_created}`);
    console.log(`  Most used endpoint: ${userStats.most_used_endpoint || 'N/A'}`);
    
    // Rate limiting information
    const rateInfo = usage.rate_limiting;
    console.log(`\nRate limiting status:`);
    console.log(`  Current window requests: ${rateInfo.current_window_requests}`);
    console.log(`  Hourly limit: ${rateInfo.hourly_limit}`);
    console.log(`  Remaining requests: ${rateInfo.remaining_requests}`);
    console.log(`  Status: ${rateInfo.rate_limit_status}`);
    
    // System statistics
    const systemStats = usage.system_statistics;
    console.log(`\nSystem statistics:`);
    console.log(`  Active users: ${systemStats.total_active_users.toLocaleString()}`);
    console.log(`  Total requests today: ${systemStats.total_requests_today_all_users.toLocaleString()}`);
    
    // Get system overview
    const overview = await client.getStatisticsOverview();
    console.log(`\nSystem overview:`);
    console.log(`  Total conversations: ${overview.total_conversations.toLocaleString()}`);
    console.log(`  Success rate: ${overview.processing_statistics.success_rate}`);
  } catch (error) {
    console.error('Usage monitoring error:', error);
  }
}

// Example 7: Production Workflow
async function exampleProductionWorkflow(): Promise<void> {
  console.log("\n=== Example 7: Complete Production Workflow ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  const client = new PixelatedEmpathyClient(apiKey);
  
  try {
    // Step 1: Discover datasets
    const datasets = await client.listDatasets();
    const targetDataset = datasets.length > 0 ? datasets[0].name : "priority_complete_fixed";
    console.log(`Target dataset: ${targetDataset}`);
    
    // Step 2: Query research-grade conversations
    const researchQuery: AdvancedQuery = {
      dataset: targetDataset,
      tier: QualityTier.RESEARCH,
      min_quality: 0.82,
      min_therapeutic_accuracy: 0.8,
      min_emotional_authenticity: 0.75,
      sort_by: "quality_score",
      sort_order: "desc",
      limit: 50
    };
    
    const conversations = await client.queryConversations(researchQuery);
    const conversationList = conversations.conversations || [];
    console.log(`Found ${conversationList.length} research-grade conversations`);
    
    // Step 3: Export filtered dataset
    if (conversationList.length > 0) {
      const exportRequest: BulkExportRequest = {
        dataset: targetDataset,
        format: ExportFormat.HUGGINGFACE,
        filters: researchQuery,
        include_metadata: true,
        include_quality_metrics: true
      };
      
      // Create export and wait for completion
      try {
        const finalStatus = await client.exportAndWait(
          exportRequest,
          10000, // Check every 10 seconds
          300000 // 5 minute timeout
        );
        
        if (finalStatus.status === JobStatus.COMPLETED) {
          console.log(`Export completed successfully!`);
          console.log(`  File size: ${(finalStatus.file_size || 0).toLocaleString()} bytes`);
          console.log(`  Download URL: ${finalStatus.download_url || 'N/A'}`);
        } else {
          console.log(`Export failed: ${finalStatus.error_message || 'Unknown error'}`);
        }
      } catch (error) {
        console.log(`Export workflow error: ${error}`);
      }
    }
  } catch (error) {
    console.error('Production workflow error:', error);
  }
}

// Example 8: Error Handling and Resilience
async function exampleErrorHandling(): Promise<void> {
  console.log("\n=== Example 8: Error Handling and Resilience ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  
  // Custom client with specific retry settings
  const client = new PixelatedEmpathyClient(apiKey, {
    timeout: 10000,
    maxRetries: 5,
    retryDelay: 2000,
    enableLogging: true
  });
  
  const results: number[] = [];
  
  try {
    // This might hit rate limits or timeout
    for (let i = 0; i < 10; i++) {
      try {
        const datasets = await client.listDatasets();
        results.push(datasets.length);
        console.log(`Request ${i + 1}: ${datasets.length} datasets`);
        
      } catch (error) {
        console.log(`Request ${i + 1} failed: ${error.constructor.name}: ${error.message}`);
        
        // Handle specific error types
        if (error instanceof RateLimitError && error.retryAfter) {
          console.log(`Rate limited, retry after: ${error.retryAfter} seconds`);
        } else if (error instanceof AuthenticationError) {
          console.log("Authentication failed - check your API key");
          break;
        } else if (error instanceof PixelatedEmpathyError && error.statusCode === 400) {
          console.log("Bad request - check your parameters");
        }
        
        // Continue with other requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
  
  console.log(`Completed ${results.length} successful requests`);
}

// Example 9: Convenience Functions
async function exampleConvenienceFunctions(): Promise<void> {
  console.log("\n=== Example 9: Convenience Functions ===");
  
  const apiKey = process.env.PIXELATED_API_KEY || 'demo-api-key';
  
  try {
    // Quick query without managing client
    const query: AdvancedQuery = {
      tier: QualityTier.PROFESSIONAL,
      min_quality: 0.8,
      limit: 5
    };
    
    const results = await quickQuery(apiKey, query);
    const conversations = results.conversations || [];
    console.log(`Quick query found ${conversations.length} conversations`);
    
    // Quick export
    const jobId = await quickExport(apiKey, "priority_complete_fixed", ExportFormat.CSV);
    console.log(`Quick export job created: ${jobId}`);
    
  } catch (error) {
    console.log(`Convenience function error: ${error}`);
  }
}

// Example 10: Browser-Specific Usage (for browser environments)
function exampleBrowserUsage(): void {
  console.log("\n=== Example 10: Browser-Specific Usage ===");
  
  // This example shows how to use the client in a browser environment
  const browserExample = `
// HTML
<script type="module">
  import { PixelatedEmpathyClient, QualityTier } from './dist/pixelated-empathy-client.js';
  
  // Initialize client
  const client = new PixelatedEmpathyClient('your-api-key');
  
  // Query conversations
  const conversations = await client.queryConversations({
    tier: QualityTier.PROFESSIONAL,
    min_quality: 0.8,
    limit: 10
  });
  
  // Display results in DOM
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = \`Found \${conversations.length} conversations\`;
  
  // Handle errors gracefully
  try {
    const datasets = await client.listDatasets();
    console.log('Available datasets:', datasets);
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.log('Rate limited, please wait');
    } else {
      console.error('API error:', error.message);
    }
  }
</script>
  `;
  
  console.log("Browser usage example:");
  console.log(browserExample);
}

// Main example runner
async function main(): Promise<void> {
  console.log("Pixelated Empathy AI - TypeScript Client Examples");
  console.log("=".repeat(50));
  
  const examples = [
    exampleBasicDiscovery,
    exampleAdvancedQuerying,
    exampleContentSearch,
    exampleBulkExport,
    exampleQualityAssessment,
    exampleUsageMonitoring,
    exampleProductionWorkflow,
    exampleErrorHandling,
    exampleConvenienceFunctions,
    exampleBrowserUsage,
  ];
  
  for (let i = 0; i < examples.length; i++) {
    try {
      await examples[i]();
      if (i < examples.length - 1) {
        console.log("\n" + "-".repeat(50));
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      }
    } catch (error) {
      console.log(`Example ${i + 1} failed: ${error}`);
    }
  }
}

// Export for module usage
export {
  exampleBasicDiscovery,
  exampleAdvancedQuerying,
  exampleContentSearch,
  exampleBulkExport,
  exampleQualityAssessment,
  exampleUsageMonitoring,
  exampleProductionWorkflow,
  exampleErrorHandling,
  exampleConvenienceFunctions,
  exampleBrowserUsage,
  main
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Set your API key in environment variable or replace here
  if (!process.env.PIXELATED_API_KEY) {
    console.log("⚠️  Set PIXELATED_API_KEY environment variable for live testing");
    console.log("   Using demo key for examples (will show mock responses)");
    console.log();
  }
  
  main().catch(console.error);
}