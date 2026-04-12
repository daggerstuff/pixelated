import { type ChangeEvent, useEffect, useState } from 'react'

import { Button } from '../../ui/button/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../ui/card/card'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { Switch } from '../../ui/switch'
import { Textarea } from '../../ui/textarea'

import { dlpService, type DLPRule, DLPAction } from '../../../lib/security/dlp'

// Default empty rule (matchPattern is the functional pattern; name is descriptive only)
const defaultRule = {
  id: '',
  name: '',
  description: '',
  matchPattern: '',
  action: DLPAction.REDACT,
  isActive: true,
}

/** Escape special regex characters so the pattern is treated as a literal string. */
function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * DLP Rule Editor Component
 *
 * Handles creating new rules and editing existing ones
 */
/** Editor state: DLPRule fields plus matchPattern (not persisted on DLPRule, used to build matches/redact). */
type EditorRule = Partial<DLPRule> & { matchPattern?: string }
type EditorRuleChangeField =
  | 'id'
  | 'name'
  | 'matchPattern'
  | 'description'
  | 'action'
  | 'isActive'

type RecordLike = Record<string, unknown>

const isRecordLike = (value: unknown): value is RecordLike => {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const isDLPAction = (value: unknown): value is DLPAction => {
  return (
    typeof value === 'string' &&
    new Set<string>(Object.values(DLPAction)).has(value)
  )
}

const isEditorRule = (detail: unknown): detail is EditorRule => {
  if (!isRecordLike(detail)) {
    return false
  }

  return (
    (detail.id === undefined || typeof detail.id === 'string') &&
    (detail.name === undefined || typeof detail.name === 'string') &&
    (detail.matchPattern === undefined || typeof detail.matchPattern === 'string') &&
    (detail.description === undefined || typeof detail.description === 'string') &&
    (detail.action === undefined || isDLPAction(detail.action)) &&
    (detail.isActive === undefined || typeof detail.isActive === 'boolean')
  )
}

export default function DLPRuleEditor() {
  const [currentRule, setCurrentRule] = useState<EditorRule>(defaultRule)
  const [isEditing, setIsEditing] = useState(false)

  // Listen for edit-rule events
  useEffect(() => {
    const handleEditRule = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const detail: unknown = event.detail
      if (!isEditorRule(detail)) {
        return
      }

      setCurrentRule({
        ...defaultRule,
        ...detail,
        matchPattern: detail.matchPattern ?? '',
        action: detail.action ?? DLPAction.REDACT,
        isActive: detail.isActive ?? true,
        description: detail.description ?? '',
      })
      setIsEditing(true)
    }

    const handleNewRule = () => {
      setCurrentRule(defaultRule)
      setIsEditing(false)
    }

    // Add event listeners
    document.addEventListener('dlp:edit-rule', handleEditRule)
    document.addEventListener('dlp:new-rule', handleNewRule)

    // Clean up event listeners on unmount
    return () => {
      document.removeEventListener('dlp:edit-rule', handleEditRule)
      document.removeEventListener('dlp:new-rule', handleNewRule)
    }
  }, [])

  const handleChange = (
    field: EditorRuleChangeField,
    value: string | boolean | DLPAction,
  ) => {
    setCurrentRule((prevRule) => ({
      ...prevRule,
      [field]: value,
    }))
  }

  const handleTextChange =
    (field: 'id' | 'name' | 'matchPattern' | 'description') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleChange(field, event.target.value)
    }

  const handleActionChange = (value: string) => {
    if (!isDLPAction(value)) {
      return
    }
    handleChange('action', value)
  }

  // Save rule
  const saveRule = () => {
    const pattern = currentRule.matchPattern?.trim() ?? ''
    if (!currentRule.id || !currentRule.name) {
      document.dispatchEvent(
        new CustomEvent('dlp:error', {
          detail: { message: 'Rule ID and name are required' },
        }),
      )
      return
    }
    if (!pattern) {
      document.dispatchEvent(
        new CustomEvent('dlp:error', {
          detail: {
            message:
              'Match pattern is required (this is the term or regex to detect)',
          },
        }),
      )
      return
    }

    try {
      const escaped = escapeRegexLiteral(pattern)
      const ruleToSave: DLPRule = {
        id: currentRule.id ?? '',
        name: currentRule.name ?? '',
        description: currentRule.description ?? '',
        action: currentRule.action ?? DLPAction.REDACT,
        isActive: currentRule.isActive ?? true,
        matches: (content: string) => {
          return content.toLowerCase().includes(pattern.toLowerCase())
        },
      }

      if (ruleToSave.action === DLPAction.REDACT) {
        ruleToSave.redact = (content: string) => {
          return content.replace(new RegExp(escaped, 'gi'), '[REDACTED]')
        }
      }

      // Add to DLP service
      dlpService.addRule(ruleToSave)

      // Dispatch event to notify that a rule has been saved
      document.dispatchEvent(
        new CustomEvent('dlp:rule-saved', {
          detail: {
            rule: ruleToSave,
            isEditing,
          },
        }),
      )

      // Reset the form and switch to rules tab
      setCurrentRule(defaultRule)
      setIsEditing(false)

      // Switch back to rules tab
      const rulesTab = document.querySelector('[value="rules"]')
      if (rulesTab instanceof HTMLElement) {
        setTimeout(() => {
          rulesTab.click()

          // Trigger event to refresh rules list
          document.dispatchEvent(new CustomEvent('dlp:rules-updated'))
        }, 100)
      }
    } catch (error: unknown) {
      console.error('Error saving rule:', error)
      document.dispatchEvent(
        new CustomEvent('dlp:error', {
          detail: {
            message: `Error saving rule: ${error instanceof Error ? String(error) : String(error)}`,
          },
        }),
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Edit DLP Rule' : 'Create New DLP Rule'}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? 'Modify the existing DLP rule'
            : 'Define a new rule to control how sensitive data is handled'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className='space-y-4'
          onSubmit={(e) => {
            e.preventDefault()
            saveRule()
          }}
        >
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='rule-id'>Rule ID</Label>
              <Input
                id='rule-id'
                placeholder='unique-rule-id'
                value={currentRule.id}
                onChange={handleTextChange('id')}
                readOnly={isEditing}
                className={isEditing ? 'bg-muted' : ''}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='rule-name'>Rule Name</Label>
              <Input
                id='rule-name'
                placeholder='PHI Detection'
                value={currentRule.name}
                onChange={handleTextChange('name')}
              />
              <p className='text-muted-foreground text-xs'>
                Descriptive label only; not used for matching.
              </p>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rule-pattern'>Match pattern</Label>
            <Input
              id='rule-pattern'
              placeholder='e.g. SSN, \\d{3}-\\d{2}-\\d{4}, or literal phrase'
              value={currentRule.matchPattern ?? ''}
              onChange={handleTextChange('matchPattern')}
            />
            <p className='text-muted-foreground text-xs'>
              Literal text or regex to detect. Content matching this will
              trigger the rule.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rule-description'>Description</Label>
            <Textarea
              id='rule-description'
              placeholder='Describe what this rule does and when it applies'
              value={currentRule.description}
              onChange={handleTextChange('description')}
              rows={3}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='rule-action'>Action</Label>
              <Select
                value={currentRule.action ?? DLPAction.REDACT}
                onValueChange={handleActionChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DLPAction.ALLOW}>Allow</SelectItem>
                  <SelectItem value={DLPAction.REDACT}>Redact</SelectItem>
                  <SelectItem value={DLPAction.BLOCK}>Block</SelectItem>
                  <SelectItem value={DLPAction.BLOCK_AND_ALERT}>
                    Block & Alert
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='flex items-center space-x-2 pt-6'>
              <Switch
                id='rule-active'
                checked={!!currentRule.isActive}
                onCheckedChange={(checked: boolean) => handleChange('isActive', checked)}
              />

              <Label htmlFor='rule-active'>Active</Label>
            </div>
          </div>

          {currentRule.action === DLPAction.REDACT && (
            <div className='bg-muted rounded-md p-4'>
              <p className='text-muted-foreground mb-2 text-sm'>
                <strong>Preview:</strong> When this rule is triggered, matching
                content will be redacted.
              </p>
              <div className='text-sm'>
                <span>Original: </span>
                <span className='font-mono'>
                  This contains {currentRule.matchPattern ?? '[pattern]'}
                </span>
              </div>
              <div className='text-sm'>
                <span>Redacted: </span>
                <span className='font-mono'>This contains [REDACTED]</span>
              </div>
            </div>
          )}

          <div className='flex justify-end space-x-2 pt-4'>
            <Button
              type='button'
              onClick={() => {
                setCurrentRule(defaultRule)
                setIsEditing(false)

                // Switch back to rules tab
                const rulesTab = document.querySelector('[value="rules"]')
                if (rulesTab instanceof HTMLElement) {
                  rulesTab.click()
                }
              }}
            >
              Cancel
            </Button>
            <Button type='submit'>
              {isEditing ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
