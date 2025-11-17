## MCP Server Prompts Documentation

This document provides comprehensive documentation for all prompts available in the Journal Dataset Research MCP Server.

## Table of Contents

- [Overview](#overview)
- [Discovery Workflow Prompt](#discovery-workflow-prompt)
- [Evaluation Workflow Prompt](#evaluation-workflow-prompt)
- [Acquisition Workflow Prompt](#acquisition-workflow-prompt)
- [Integration Workflow Prompt](#integration-workflow-prompt)
- [Prompt Access](#prompt-access)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)

## Overview

Prompts provide workflow guidance and instructions for using the research system. Prompts are rendered with parameters to generate contextual instructions that guide AI agents through research workflows.

### Prompt Rendering

Prompts are rendered with parameters to generate contextual instructions:

```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "discover_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling"],
      "sources": ["pubmed", "doaj"]
    }
  },
  "id": 1
}
```

### Prompt Response Format

```json
{
  "jsonrpc": "2.0",
  "result": {
    "name": "discover_sources_workflow",
    "description": "Guide for discovering dataset sources from academic repositories...",
    "arguments": [
      {
        "name": "session_id",
        "type": "string",
        "description": "The research session ID",
        "required": true
      }
    ],
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "# Source Discovery Workflow\n\n## Overview\n..."
        }
      }
    ]
  },
  "id": 1
}
```

## Discovery Workflow Prompt

**Name**: `discover_sources_workflow`

**Description**: Guide for discovering dataset sources from academic repositories. This prompt provides step-by-step instructions for using the discovery workflow to find relevant datasets.

**Arguments**:
- `session_id` (string, required): The research session ID
- `keywords` (array, required): List of search keywords (e.g., `["therapy", "counseling", "mental health"]`)
- `sources` (array, required): List of target sources to search (e.g., `["pubmed", "doaj", "dryad"]`)

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "discover_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling", "mental health"],
      "sources": ["pubmed", "doaj", "dryad"]
    }
  },
  "id": 1
}
```

**Rendered Content**: The prompt provides:
- Overview of the discovery workflow
- Step-by-step instructions for preparing discovery parameters
- Instructions for executing the `discover_sources` tool
- Guidance on reviewing discovery results
- Instructions for filtering and refining results
- Best practices for keyword selection and source selection
- Example usage

**Key Sections**:
1. **Overview**: Introduction to source discovery
2. **Step 1**: Prepare discovery parameters
3. **Step 2**: Execute discovery
4. **Step 3**: Review discovery results
5. **Step 4**: Filter and refine (optional)
6. **Step 5**: Next steps
7. **Best Practices**: Keyword selection, source selection, deduplication
8. **Example Usage**: Code examples

---

## Evaluation Workflow Prompt

**Name**: `evaluate_sources_workflow`

**Description**: Guide for evaluating dataset sources across multiple quality dimensions. This prompt provides step-by-step instructions for using the evaluation workflow to assess dataset quality and prioritize sources.

**Arguments**:
- `session_id` (string, required): The research session ID
- `source_ids` (array, optional): Optional list of specific source IDs to evaluate. If not provided, all sources in the session will be evaluated.

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "evaluate_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1", "source_2"]
    }
  },
  "id": 1
}
```

**Rendered Content**: The prompt provides:
- Overview of the evaluation workflow
- Explanation of evaluation dimensions (therapeutic relevance, data structure quality, training integration potential, ethical accessibility)
- Scoring system and priority tiers
- Step-by-step instructions for preparing evaluation parameters
- Instructions for executing the `evaluate_sources` tool
- Guidance on reviewing evaluation results
- Instructions for filtering and prioritizing
- Best practices for prioritization and compliance
- Example usage

**Key Sections**:
1. **Overview**: Introduction to dataset evaluation
2. **Evaluation Dimensions**: Four quality dimensions with weights
3. **Scoring System**: Scoring methodology and priority tiers
4. **Step 1**: Prepare evaluation parameters
5. **Step 2**: Execute evaluation
6. **Step 3**: Review evaluation results
7. **Step 4**: Filter and prioritize
8. **Step 5**: Review individual evaluations
9. **Step 6**: Next steps
10. **Best Practices**: Prioritization, compliance, integration considerations

---

## Acquisition Workflow Prompt

**Name**: `acquire_datasets_workflow`

**Description**: Guide for acquiring datasets from identified sources. This prompt provides step-by-step instructions for using the acquisition workflow to download and store datasets.

**Arguments**:
- `session_id` (string, required): The research session ID
- `source_ids` (array, optional): Optional list of specific source IDs to acquire. If not provided, all evaluated sources in the session will be acquired.

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "acquire_datasets_workflow",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1", "source_2"]
    }
  },
  "id": 1
}
```

**Rendered Content**: The prompt provides:
- Overview of the acquisition workflow
- Explanation of the acquisition process (access method determination, access request submission, dataset download, storage and validation)
- Access methods (direct download, API access, access request, collaboration, registration)
- Step-by-step instructions for preparing acquisition parameters
- Instructions for executing the `acquire_datasets` tool
- Guidance on reviewing acquisition results
- Instructions for monitoring acquisition progress
- Instructions for handling failed acquisitions
- Best practices for prioritization, batch processing, error handling
- Example usage

**Key Sections**:
1. **Overview**: Introduction to dataset acquisition
2. **Acquisition Process**: Four-step process explanation
3. **Access Methods**: Different access methods available
4. **Step 1**: Prepare acquisition parameters
5. **Step 2**: Execute acquisition
6. **Step 3**: Review acquisition results
7. **Step 4**: Monitor acquisition progress
8. **Step 5**: Handle failed acquisitions
9. **Step 6**: Next steps
10. **Best Practices**: Prioritization, batch processing, error handling, storage management

---

## Integration Workflow Prompt

**Name**: `create_integration_plans_workflow`

**Description**: Guide for creating integration plans for acquired datasets. This prompt provides step-by-step instructions for using the integration planning workflow to prepare datasets for training pipeline integration.

**Arguments**:
- `session_id` (string, required): The research session ID
- `source_ids` (array, optional): Optional list of specific source IDs to create integration plans for. If not provided, all acquired datasets in the session will be used.
- `target_format` (string, optional): Target format for integration (chatml or conversation_record). Default: `"chatml"`

**Example**:
```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "create_integration_plans_workflow",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1"],
      "target_format": "chatml"
    }
  },
  "id": 1
}
```

**Rendered Content**: The prompt provides:
- Overview of the integration planning workflow
- Explanation of the integration planning process (dataset structure analysis, schema mapping, transformation specification, complexity estimation, preprocessing script generation)
- Target formats (ChatML format, ConversationRecord format)
- Complexity levels (low, medium, high)
- Step-by-step instructions for preparing integration parameters
- Instructions for executing the `create_integration_plans` tool
- Guidance on reviewing integration plans
- Instructions for generating preprocessing scripts
- Best practices for format selection, complexity assessment, batch planning
- Example usage

**Key Sections**:
1. **Overview**: Introduction to integration planning
2. **Integration Planning Process**: Five-step process explanation
3. **Target Formats**: ChatML and ConversationRecord formats
4. **Complexity Levels**: Low, medium, high complexity definitions
5. **Step 1**: Prepare integration parameters
6. **Step 2**: Execute integration planning
7. **Step 3**: Review integration plans
8. **Step 4**: Review individual plans
9. **Step 5**: Generate preprocessing scripts
10. **Step 6**: Next steps
11. **Best Practices**: Format selection, complexity assessment, batch planning, script generation

---

## Prompt Access

### Listing Prompts

List all available prompts:

```json
{
  "jsonrpc": "2.0",
  "method": "prompts/list",
  "params": {},
  "id": 1
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "prompts": [
      {
        "name": "discover_sources_workflow",
        "description": "Guide for discovering dataset sources from academic repositories...",
        "arguments": [
          {
            "name": "session_id",
            "type": "string",
            "description": "The research session ID",
            "required": true
          }
        ]
      },
      {
        "name": "evaluate_sources_workflow",
        "description": "Guide for evaluating dataset sources across multiple quality dimensions...",
        "arguments": [
          {
            "name": "session_id",
            "type": "string",
            "description": "The research session ID",
            "required": true
          }
        ]
      },
      {
        "name": "acquire_datasets_workflow",
        "description": "Guide for acquiring datasets from identified sources...",
        "arguments": [
          {
            "name": "session_id",
            "type": "string",
            "description": "The research session ID",
            "required": true
          }
        ]
      },
      {
        "name": "create_integration_plans_workflow",
        "description": "Guide for creating integration plans for acquired datasets...",
        "arguments": [
          {
            "name": "session_id",
            "type": "string",
            "description": "The research session ID",
            "required": true
          }
        ]
      }
    ]
  },
  "id": 1
}
```

### Getting a Prompt

Get a rendered prompt:

```json
{
  "jsonrpc": "2.0",
  "method": "prompts/get",
  "params": {
    "name": "discover_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling"],
      "sources": ["pubmed", "doaj"]
    }
  },
  "id": 1
}
```

**Parameters**:
- `name` (string, required): Prompt name
- `arguments` (object, required): Prompt arguments

**Response**: See individual prompt documentation above.

---

## Error Handling

### Error Codes

- `INVALID_PARAMS` (-32602): Missing required parameters or invalid parameter types
- `RESOURCE_NOT_FOUND` (-32010): Prompt not found
- `INTERNAL_ERROR` (-32603): Internal server error

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32010,
    "message": "Prompt not found: invalid_prompt_name",
    "data": {
      "name": "invalid_prompt_name"
    }
  },
  "id": 1
}
```

### Common Errors

1. **Missing required arguments**: Ensure all required arguments are provided
2. **Invalid argument types**: Check argument types match the schema
3. **Prompt not found**: Verify prompt name is correct
4. **Argument validation failed**: Check argument validation rules

---

## Usage Examples

### Get Discovery Workflow Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "discover_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling", "mental health"],
      "sources": ["pubmed", "doaj", "dryad"]
    }
  }
}
```

### Get Evaluation Workflow Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "evaluate_sources_workflow",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1", "source_2"]
    }
  }
}
```

### Get Acquisition Workflow Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "acquire_datasets_workflow",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1"]
    }
  }
}
```

### Get Integration Workflow Prompt

```json
{
  "method": "prompts/get",
  "params": {
    "name": "create_integration_plans_workflow",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1"],
      "target_format": "chatml"
    }
  }
}
```

### List All Prompts

```json
{
  "method": "prompts/list",
  "params": {}
}
```

---

## Best Practices

1. **Argument Validation**: Always provide all required arguments
2. **Context-Specific**: Prompts are rendered with context-specific parameters
3. **Workflow Guidance**: Use prompts to guide AI agents through workflows
4. **Error Handling**: Handle errors gracefully and check error codes
5. **Prompt Updates**: Prompts are static templates; check for updates

---

For more information, see the [API Documentation](./README.md).

