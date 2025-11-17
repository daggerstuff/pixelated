## MCP Server Tools Documentation

This document provides comprehensive documentation for all tools available in the Journal Dataset Research MCP Server.

## Table of Contents

- [Session Management Tools](#session-management-tools)
- [Source Discovery Tools](#source-discovery-tools)
- [Dataset Evaluation Tools](#dataset-evaluation-tools)
- [Dataset Acquisition Tools](#dataset-acquisition-tools)
- [Integration Planning Tools](#integration-planning-tools)
- [Report Generation Tools](#report-generation-tools)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)

## Session Management Tools

### create_session

Create a new research session with target sources and search keywords.

**Parameters:**
- `target_sources` (array, required): List of target sources (e.g., `["pubmed", "doaj"]`)
- `search_keywords` (object, required): Dictionary of search keywords by category
  - Example: `{"therapeutic": ["therapy", "counseling"], "dataset": ["dataset", "conversation"]}`
- `weekly_targets` (object, optional): Dictionary of weekly targets
  - Example: `{"sources_identified": 10, "datasets_evaluated": 5}`
- `session_id` (string, optional): Custom session ID (auto-generated if not provided)

**Returns:**
```json
{
  "session_id": "session_123",
  "target_sources": ["pubmed", "doaj"],
  "search_keywords": {
    "therapeutic": ["therapy", "counseling"]
  },
  "weekly_targets": {
    "sources_identified": 10
  },
  "created_at": "2025-01-15T10:00:00Z",
  "status": "active"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_session",
    "arguments": {
      "target_sources": ["pubmed", "doaj"],
      "search_keywords": {
        "therapeutic": ["therapy", "counseling"],
        "dataset": ["dataset", "conversation"]
      },
      "weekly_targets": {
        "sources_identified": 10,
        "datasets_evaluated": 5
      }
    }
  },
  "id": 1
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Invalid parameters (e.g., empty target_sources or search_keywords)
- `TOOL_EXECUTION_ERROR` (-32000): Failed to create session

---

### list_sessions

List all research sessions.

**Parameters:**
- `filters` (object, optional): Filters for session listing
  - `status` (string, optional): Filter by status (e.g., "active", "completed")
  - `created_after` (string, optional): Filter by creation date (ISO format)
  - `created_before` (string, optional): Filter by creation date (ISO format)

**Returns:**
```json
{
  "sessions": [
    {
      "session_id": "session_123",
      "target_sources": ["pubmed"],
      "status": "active",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "list_sessions",
    "arguments": {
      "filters": {
        "status": "active"
      }
    }
  },
  "id": 1
}
```

---

### get_session

Get details for a specific research session.

**Parameters:**
- `session_id` (string, required): Session ID

**Returns:**
```json
{
  "session_id": "session_123",
  "target_sources": ["pubmed", "doaj"],
  "search_keywords": {
    "therapeutic": ["therapy"]
  },
  "weekly_targets": {
    "sources_identified": 10
  },
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing session_id
- `TOOL_EXECUTION_ERROR` (-32000): Session not found

---

### update_session

Update a research session.

**Parameters:**
- `session_id` (string, required): Session ID
- `updates` (object, required): Updates to apply
  - `target_sources` (array, optional): New target sources
  - `search_keywords` (object, optional): New search keywords
  - `weekly_targets` (object, optional): New weekly targets
  - `status` (string, optional): New status

**Returns:**
```json
{
  "session_id": "session_123",
  "target_sources": ["pubmed", "doaj", "dryad"],
  "updated_at": "2025-01-15T11:00:00Z"
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Invalid parameters
- `TOOL_EXECUTION_ERROR` (-32000): Session not found or update failed

---

### delete_session

Delete a research session.

**Parameters:**
- `session_id` (string, required): Session ID

**Returns:**
```json
{
  "session_id": "session_123",
  "deleted": true,
  "deleted_at": "2025-01-15T12:00:00Z"
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing session_id
- `TOOL_EXECUTION_ERROR` (-32000): Session not found or deletion failed

---

## Source Discovery Tools

### discover_sources

Discover dataset sources for a research session using keywords and target sources.

**Parameters:**
- `session_id` (string, required): Session ID
- `keywords` (array, required): List of search keywords (e.g., `["therapy", "counseling", "dataset"]`)
- `sources` (array, required): List of target sources
  - Allowed values: `["pubmed", "pubmed_central", "doaj", "dryad", "zenodo", "clinical_trials"]`

**Returns:**
```json
{
  "session_id": "session_123",
  "total_sources": 25,
  "sources": [
    {
      "source_id": "source_1",
      "title": "Therapy Dataset",
      "authors": ["Author 1", "Author 2"],
      "doi": "10.1234/example",
      "publication_date": "2024-01-01",
      "source_type": "journal",
      "access_method": "open_access",
      "metadata": {}
    }
  ],
  "status": "completed"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "discover_sources",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling", "mental health"],
      "sources": ["pubmed", "doaj", "dryad"]
    }
  },
  "id": 1
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing required parameters or empty arrays
- `TOOL_EXECUTION_ERROR` (-32000): Discovery failed
- `TOOL_TIMEOUT` (-32002): Discovery operation timed out

**Notes:**
- This is an async operation that may take several minutes
- Progress updates are available via progress resources
- Sources are automatically deduplicated by DOI and similarity

---

### get_sources

Get all sources for a research session.

**Parameters:**
- `session_id` (string, required): Session ID
- `filters` (object, optional): Filters for source listing
  - `source_type` (string, optional): Filter by source type
  - `access_method` (string, optional): Filter by access method
  - `published_after` (string, optional): Filter by publication date (ISO format)
  - `published_before` (string, optional): Filter by publication date (ISO format)

**Returns:**
```json
{
  "sources": [
    {
      "source_id": "source_1",
      "title": "Therapy Dataset",
      "authors": ["Author 1"],
      "doi": "10.1234/example",
      "publication_date": "2024-01-01",
      "source_type": "journal",
      "access_method": "open_access"
    }
  ],
  "total": 25
}
```

---

### get_source

Get details for a specific source.

**Parameters:**
- `session_id` (string, required): Session ID
- `source_id` (string, required): Source ID

**Returns:**
```json
{
  "source_id": "source_1",
  "title": "Therapy Dataset",
  "authors": ["Author 1", "Author 2"],
  "doi": "10.1234/example",
  "publication_date": "2024-01-01",
  "source_type": "journal",
  "access_method": "open_access",
  "metadata": {
    "abstract": "Dataset description...",
    "keywords": ["therapy", "counseling"]
  }
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing required parameters
- `TOOL_EXECUTION_ERROR` (-32000): Source not found

---

### filter_sources

Filter sources for a research session.

**Parameters:**
- `session_id` (string, required): Session ID
- `filters` (object, required): Filters to apply
  - `source_type` (string, optional): Filter by source type
  - `access_method` (string, optional): Filter by access method
  - `published_after` (string, optional): Filter by publication date (ISO format)
  - `published_before` (string, optional): Filter by publication date (ISO format)
  - `title_search` (string, optional): Search in titles
  - `author_search` (string, optional): Search in authors

**Returns:**
```json
{
  "sources": [
    {
      "source_id": "source_1",
      "title": "Therapy Dataset",
      "source_type": "journal"
    }
  ],
  "total": 10,
  "filters_applied": {
    "source_type": "journal"
  }
}
```

---

## Dataset Evaluation Tools

### evaluate_sources

Evaluate dataset sources for a research session. This tool initiates evaluation of sources using the evaluation engine, which assesses therapeutic relevance, data structure quality, training integration, and ethical accessibility.

**Parameters:**
- `session_id` (string, required): Session ID
- `source_ids` (array, optional): List of source IDs to evaluate. If not provided, all sources in the session will be evaluated.

**Returns:**
```json
{
  "session_id": "session_123",
  "evaluations": [
    {
      "evaluation_id": "eval_1",
      "source_id": "source_1",
      "therapeutic_relevance_score": 0.85,
      "data_structure_score": 0.90,
      "training_integration_score": 0.80,
      "ethical_accessibility_score": 0.95,
      "overall_score": 0.875,
      "status": "completed",
      "evaluated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total_evaluated": 1,
  "status": "completed"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "evaluate_sources",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1", "source_2"]
    }
  },
  "id": 1
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing session_id
- `TOOL_EXECUTION_ERROR` (-32000): Evaluation failed
- `TOOL_TIMEOUT` (-32002): Evaluation operation timed out

**Notes:**
- This is an async operation that may take several minutes
- Progress updates are available via progress resources
- Evaluation scores range from 0.0 to 1.0

---

### get_evaluations

Get all evaluations for a research session.

**Parameters:**
- `session_id` (string, required): Session ID
- `filters` (object, optional): Filters for evaluation listing
  - `min_score` (number, optional): Minimum overall score
  - `status` (string, optional): Filter by status
  - `evaluated_after` (string, optional): Filter by evaluation date (ISO format)

**Returns:**
```json
{
  "evaluations": [
    {
      "evaluation_id": "eval_1",
      "source_id": "source_1",
      "overall_score": 0.875,
      "status": "completed"
    }
  ],
  "total": 1
}
```

---

### get_evaluation

Get details for a specific evaluation.

**Parameters:**
- `session_id` (string, required): Session ID
- `evaluation_id` (string, required): Evaluation ID

**Returns:**
```json
{
  "evaluation_id": "eval_1",
  "source_id": "source_1",
  "therapeutic_relevance_score": 0.85,
  "data_structure_score": 0.90,
  "training_integration_score": 0.80,
  "ethical_accessibility_score": 0.95,
  "overall_score": 0.875,
  "status": "completed",
  "evaluated_at": "2025-01-15T10:00:00Z",
  "details": {
    "therapeutic_relevance": {
      "score": 0.85,
      "factors": ["relevant_domain", "appropriate_content"]
    }
  }
}
```

---

### update_evaluation

Update an evaluation (e.g., override scores, add notes).

**Parameters:**
- `session_id` (string, required): Session ID
- `evaluation_id` (string, required): Evaluation ID
- `updates` (object, required): Updates to apply
  - `overall_score` (number, optional): Override overall score
  - `notes` (string, optional): Add notes
  - `status` (string, optional): Update status

**Returns:**
```json
{
  "evaluation_id": "eval_1",
  "overall_score": 0.90,
  "notes": "Updated after review",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

## Dataset Acquisition Tools

### acquire_datasets

Acquire dataset sources for a research session. This tool initiates the acquisition process by submitting access requests and downloading datasets from the specified sources.

**Parameters:**
- `session_id` (string, required): Session ID
- `source_ids` (array, optional): List of source IDs to acquire. If not provided, all sources in the session will be acquired.

**Returns:**
```json
{
  "session_id": "session_123",
  "acquired": ["source_1", "source_2"],
  "acquisitions": [
    {
      "acquisition_id": "acq_1",
      "source_id": "source_1",
      "status": "completed",
      "storage_path": "/data/datasets/source_1",
      "acquired_at": "2025-01-15T10:00:00Z",
      "file_size": 1048576,
      "file_format": "csv"
    }
  ],
  "total_acquired": 2,
  "status": "completed"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "acquire_datasets",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1", "source_2"]
    }
  },
  "id": 1
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing session_id
- `TOOL_EXECUTION_ERROR` (-32000): Acquisition failed
- `TOOL_TIMEOUT` (-32002): Acquisition operation timed out

**Notes:**
- This is an async operation that may take several minutes
- Progress updates are available via progress resources
- Datasets are downloaded and stored locally

---

### get_acquisitions

Get all acquisitions for a research session.

**Parameters:**
- `session_id` (string, required): Session ID
- `filters` (object, optional): Filters for acquisition listing
  - `status` (string, optional): Filter by status
  - `acquired_after` (string, optional): Filter by acquisition date (ISO format)

**Returns:**
```json
{
  "acquisitions": [
    {
      "acquisition_id": "acq_1",
      "source_id": "source_1",
      "status": "completed",
      "storage_path": "/data/datasets/source_1"
    }
  ],
  "total": 2
}
```

---

### get_acquisition

Get details for a specific acquisition.

**Parameters:**
- `session_id` (string, required): Session ID
- `acquisition_id` (string, required): Acquisition ID

**Returns:**
```json
{
  "acquisition_id": "acq_1",
  "source_id": "source_1",
  "status": "completed",
  "storage_path": "/data/datasets/source_1",
  "acquired_at": "2025-01-15T10:00:00Z",
  "file_size": 1048576,
  "file_format": "csv",
  "metadata": {
    "download_url": "https://example.com/dataset",
    "checksum": "abc123"
  }
}
```

---

### update_acquisition

Update an acquisition (e.g., update status, add notes).

**Parameters:**
- `session_id` (string, required): Session ID
- `acquisition_id` (string, required): Acquisition ID
- `status` (string, optional): Update status (e.g., "completed", "failed", "pending")

**Returns:**
```json
{
  "acquisition_id": "acq_1",
  "status": "completed",
  "updated_at": "2025-01-15T11:00:00Z"
}
```

---

## Integration Planning Tools

### create_integration_plans

Create integration plans for acquired datasets in a research session. This tool initiates integration planning by analyzing dataset structures and creating transformation specifications for integrating datasets into the training pipeline.

**Parameters:**
- `session_id` (string, required): Session ID
- `source_ids` (array, optional): List of source IDs to create integration plans for. If not provided, all acquired datasets in the session will be used.
- `target_format` (string, optional): Target format for integration
  - Allowed values: `["chatml", "conversation_record"]`
  - Default: `"chatml"`

**Returns:**
```json
{
  "session_id": "session_123",
  "plans": ["plan_1", "plan_2"],
  "integration_plans": [
    {
      "plan_id": "plan_1",
      "source_id": "source_1",
      "target_format": "chatml",
      "complexity": "medium",
      "estimated_hours": 4,
      "transformation_spec": {
        "schema_mapping": {},
        "field_transformations": []
      },
      "status": "completed",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total_plans": 2,
  "status": "completed"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "create_integration_plans",
    "arguments": {
      "session_id": "session_123",
      "source_ids": ["source_1"],
      "target_format": "chatml"
    }
  },
  "id": 1
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing session_id or invalid target_format
- `TOOL_EXECUTION_ERROR` (-32000): Integration planning failed
- `TOOL_TIMEOUT` (-32002): Integration planning operation timed out

**Notes:**
- This is an async operation that may take several minutes
- Progress updates are available via progress resources
- Integration plans include schema mappings and transformation specifications

---

### get_integration_plans

Get all integration plans for a research session.

**Parameters:**
- `session_id` (string, required): Session ID
- `filters` (object, optional): Filters for integration plan listing
  - `target_format` (string, optional): Filter by target format
  - `complexity` (string, optional): Filter by complexity (low, medium, high)
  - `status` (string, optional): Filter by status

**Returns:**
```json
{
  "integration_plans": [
    {
      "plan_id": "plan_1",
      "source_id": "source_1",
      "target_format": "chatml",
      "complexity": "medium",
      "status": "completed"
    }
  ],
  "total": 2
}
```

---

### get_integration_plan

Get details for a specific integration plan.

**Parameters:**
- `session_id` (string, required): Session ID
- `plan_id` (string, required): Integration plan ID

**Returns:**
```json
{
  "plan_id": "plan_1",
  "source_id": "source_1",
  "target_format": "chatml",
  "complexity": "medium",
  "estimated_hours": 4,
  "transformation_spec": {
    "schema_mapping": {
      "input_field": "output_field"
    },
    "field_transformations": [
      {
        "field": "input_field",
        "transformation": "normalize",
        "params": {}
      }
    ]
  },
  "status": "completed",
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

### generate_preprocessing_script

Generate a preprocessing script from an integration plan.

**Parameters:**
- `session_id` (string, required): Session ID
- `plan_id` (string, required): Integration plan ID

**Returns:**
```json
{
  "plan_id": "plan_1",
  "script": "import pandas as pd\n\ndef preprocess(data):\n    # Preprocessing logic\n    return processed_data\n",
  "script_language": "python",
  "generated_at": "2025-01-15T10:00:00Z"
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing required parameters
- `TOOL_EXECUTION_ERROR` (-32000): Script generation failed or plan not found

---

## Report Generation Tools

### generate_report

Generate a report for a research session. This tool creates comprehensive reports including session details, progress metrics, sources, evaluations, acquired datasets, and integration plans.

**Parameters:**
- `session_id` (string, required): Session ID
- `report_type` (string, optional): Type of report to generate
  - Allowed values: `["session_report", "weekly_report", "summary_report"]`
  - Default: `"session_report"`
- `format` (string, optional): Report format
  - Allowed values: `["json", "markdown", "pdf"]`
  - Default: `"json"`
- `date_range` (object, optional): Date range for report filtering
  - `start_date` (string, optional): Start date in ISO format
  - `end_date` (string, optional): End date in ISO format

**Returns:**
```json
{
  "report_id": "report_123",
  "session_id": "session_123",
  "report_type": "session_report",
  "format": "json",
  "content": {
    "session": {
      "session_id": "session_123",
      "status": "active"
    },
    "progress": {
      "sources_identified": 25,
      "datasets_evaluated": 20,
      "datasets_acquired": 15
    },
    "sources": [],
    "evaluations": [],
    "acquisitions": [],
    "integration_plans": []
  },
  "generated_at": "2025-01-15T10:00:00Z"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {
      "session_id": "session_123",
      "report_type": "session_report",
      "format": "json"
    }
  },
  "id": 1
}
```

**Errors:**
- `TOOL_VALIDATION_ERROR` (-32001): Missing session_id or invalid report_type/format
- `TOOL_EXECUTION_ERROR` (-32000): Report generation failed
- `TOOL_TIMEOUT` (-32002): Report generation operation timed out

**Notes:**
- This is an async operation that may take several minutes for large sessions
- Progress updates are available via progress resources
- Reports are stored and can be retrieved using `get_report`

---

### get_report

Get a previously generated report.

**Parameters:**
- `session_id` (string, required): Session ID
- `report_id` (string, required): Report ID

**Returns:**
```json
{
  "report_id": "report_123",
  "session_id": "session_123",
  "report_type": "session_report",
  "format": "json",
  "content": {},
  "generated_at": "2025-01-15T10:00:00Z"
}
```

---

### list_reports

List all reports for a research session.

**Parameters:**
- `session_id` (string, required): Session ID

**Returns:**
```json
{
  "reports": [
    {
      "report_id": "report_123",
      "report_type": "session_report",
      "format": "json",
      "generated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

## Error Handling

All tools follow consistent error handling patterns:

### Error Codes

- `TOOL_VALIDATION_ERROR` (-32001): Invalid parameters or missing required fields
- `TOOL_EXECUTION_ERROR` (-32000): Tool execution failed
- `TOOL_TIMEOUT` (-32002): Tool execution timed out

### Error Response Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Invalid parameters: session_id is required",
    "data": {
      "params": {},
      "error": "session_id is required"
    }
  },
  "id": 1
}
```

### Common Errors

1. **Missing Required Parameters**: Ensure all required parameters are provided
2. **Invalid Parameter Types**: Check parameter types match the schema
3. **Session Not Found**: Verify session_id exists
4. **Resource Not Found**: Verify resource IDs exist
5. **Operation Timeout**: Long-running operations may timeout; check progress resources

---

## Usage Examples

### Complete Workflow Example

```json
// 1. Create a session
{
  "method": "tools/call",
  "params": {
    "name": "create_session",
    "arguments": {
      "target_sources": ["pubmed", "doaj"],
      "search_keywords": {
        "therapeutic": ["therapy", "counseling"]
      }
    }
  }
}

// 2. Discover sources
{
  "method": "tools/call",
  "params": {
    "name": "discover_sources",
    "arguments": {
      "session_id": "session_123",
      "keywords": ["therapy", "counseling"],
      "sources": ["pubmed", "doaj"]
    }
  }
}

// 3. Evaluate sources
{
  "method": "tools/call",
  "params": {
    "name": "evaluate_sources",
    "arguments": {
      "session_id": "session_123"
    }
  }
}

// 4. Acquire datasets
{
  "method": "tools/call",
  "params": {
    "name": "acquire_datasets",
    "arguments": {
      "session_id": "session_123"
    }
  }
}

// 5. Create integration plans
{
  "method": "tools/call",
  "params": {
    "name": "create_integration_plans",
    "arguments": {
      "session_id": "session_123",
      "target_format": "chatml"
    }
  }
}

// 6. Generate report
{
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {
      "session_id": "session_123",
      "report_type": "session_report",
      "format": "json"
    }
  }
}
```

---

For more information, see the [API Documentation](./README.md).

