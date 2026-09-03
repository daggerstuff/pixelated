/**
 * BiasDashboard.components.alerts.tsx — presentational components extracted from
 * BiasDashboard.components.tsx. Pure components; no state, no effects, no API calls.
 */

import React from 'react'
import {
  AlertTriangle,
  Archive,
  Check,
  MessageSquare,
  X,
} from 'lucide-react'
import { Alert, Badge, Button, Card, CardContent, TabsContent } from '@/components/ui'
import {
  type AlertAction,
  type AlertItem,
} from './BiasDashboard.types'
import {
  getAlertColor,
} from './BiasDashboard.helpers'

// 2. HighBiasAlertNotification
// ---------------------------------------------------------------------------

export interface HighBiasAlertNotificationProps {
  newHighBiasAlert: AlertItem | null
  onDismiss: () => void
}

export const HighBiasAlertNotification: React.FC<HighBiasAlertNotificationProps> = ({ newHighBiasAlert, onDismiss }) => {
  if (!newHighBiasAlert) return null
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/10 flex items-start justify-between rounded-lg border p-4"
    >
      <div className="flex items-start space-x-3">
        <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
        <div>
          <p className="font-semibold">
            High Bias Alert: {newHighBiasAlert.type}
          </p>
          <p className="text-muted-foreground text-sm">
            {newHighBiasAlert.message}
          </p>
          {newHighBiasAlert.sessionId && (
            <p className="text-muted-foreground mt-1 text-xs">
              Session: {newHighBiasAlert.sessionId}
            </p>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. AccessibilitySkipLinks
// ---------------------------------------------------------------------------

export interface AccessibilitySkipLinksProps {
  skipLinkRef: React.RefObject<HTMLButtonElement | null>
  mainContentRef: React.RefObject<HTMLDivElement | null>
  announceToScreenReader: (message: string) => void
  announcements: string[]
}

export const AccessibilitySkipLinks: React.FC<AccessibilitySkipLinksProps> = ({
  skipLinkRef,
  mainContentRef,
  announceToScreenReader,
  announcements,
}) => {
  return (
    <>
      {/* Skip Links */}
      <div className="sr-only">
        <button
          ref={skipLinkRef}
          onClick={() => mainContentRef.current?.focus()}
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to main content (Alt+M)
        </button>
        <button
          onClick={() => announceToScreenReader('Alerts section')}
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
        >
          Skip to alerts (Alt+A)
        </button>
      </div>

      {/* Screen Reader Announcements */}
      {announcements.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          {announcements.join('. ')}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// 8. CriticalAlerts
// ---------------------------------------------------------------------------

export interface CriticalAlertsProps {
  filteredAlerts: AlertItem[]
}

export const CriticalAlerts: React.FC<CriticalAlertsProps> = ({ filteredAlerts }) => {
  const criticalHigh = filteredAlerts.filter(
    (a) => a.level === 'critical' || a.level === 'high',
  )
  if (criticalHigh.length === 0) return null

  return (
    <Alert variant="error">
      <AlertTriangle className="h-4 w-4" />
      <div>
        <p className="font-semibold">
          {criticalHigh.length} Critical/High Alert{criticalHigh.length > 1 ? 's' : ''}
        </p>
        <p className="text-sm">
          {criticalHigh.map((a) => a.type).join(', ')}
        </p>
      </div>
    </Alert>
  )
}

// ---------------------------------------------------------------------------
// 12. AlertsTab
// ---------------------------------------------------------------------------

export interface AlertsTabProps {
  filteredAlerts: AlertItem[]
  alerts: AlertItem[]
  selectedAlerts: Set<string>
  alertActions: Map<string, AlertAction[]>
  alertNotes: Map<string, string>
  onAlertAction: (alertId: string, action: string, notes?: string) => Promise<void>
  onBulkAlertAction: (alertIds: string[], action: string) => Promise<void>
  onToggleAlertSelection: (alertId: string) => void
  onSelectAllAlerts: () => void
  onClearAlertSelection: () => void
  onSetAlertLevelFilter: (value: string) => void
  onSetSelectedTimeRange: (value: string) => void
  onSetAlertNotes: (updater: (prev: Map<string, string>) => Map<string, string>) => void
}

export const AlertsTab: React.FC<AlertsTabProps> = ({
  filteredAlerts,
  alerts,
  selectedAlerts,
  alertActions,
  alertNotes,
  onAlertAction,
  onBulkAlertAction,
  onToggleAlertSelection,
  onSelectAllAlerts,
  onClearAlertSelection,
  onSetAlertLevelFilter,
  onSetSelectedTimeRange,
  onSetAlertNotes,
}) => {
  return (
    <TabsContent value="alerts" className="space-y-4">
      {/* Alert Management Controls */}
      {filteredAlerts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={
                      selectedAlerts.size === filteredAlerts.length &&
                      filteredAlerts.length > 0
                    }
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      e.target.checked ? onSelectAllAlerts() : onClearAlertSelection()
                    }
                    className="rounded"
                  />
                  <span className="text-sm">
                    {selectedAlerts.size > 0
                      ? `${selectedAlerts.size} selected`
                      : 'Select all'}
                  </span>
                </label>

                {selectedAlerts.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () =>
                        onBulkAlertAction(Array.from(selectedAlerts), 'acknowledge')
                      }
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Acknowledge
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () =>
                        onBulkAlertAction(Array.from(selectedAlerts), 'dismiss')
                      }
                    >
                      <X className="mr-1 h-4 w-4" />
                      Dismiss
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () =>
                        onBulkAlertAction(Array.from(selectedAlerts), 'archive')
                      }
                    >
                      <Archive className="mr-1 h-4 w-4" />
                      Archive
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Badge variant="secondary">{filteredAlerts.length} alerts</Badge>
                <Badge variant="destructive">
                  {
                    filteredAlerts.filter(
                      (a: AlertItem) => a.level === 'critical' || a.level === 'high',
                    ).length
                  }{' '}
                  high priority
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredAlerts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {alerts.length === 0 ? 'No active alerts' : 'No alerts match current filters'}
            </p>
            {alerts.length > 0 && filteredAlerts.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  onSetAlertLevelFilter('all')
                  onSetSelectedTimeRange('24h')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        filteredAlerts.map((alert: AlertItem) => {
          const isSelected = selectedAlerts.has(alert.alertId)
          const actions = alertActions.get(alert.alertId) ?? []
          const lastAction = actions[actions.length - 1]

          return (
            <Card key={alert.alertId} className={isSelected ? 'ring-blue-500 ring-2' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleAlertSelection(alert.alertId)}
                    className="mt-1 rounded"
                  />

                  {/* Alert Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <Badge className={`${getAlertColor(alert.level)} text-white`}>
                          {alert.level?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        <div>
                          <h4 className="font-semibold">{alert.type}</h4>
                          <p className="text-muted-foreground mt-1 text-sm">{alert.message}</p>
                          <p className="text-muted-foreground mt-2 text-xs">
                            Session: {alert.sessionId} •{' '}
                            {alert.timestamp
                              ? new Date(alert.timestamp).toLocaleString()
                              : 'Unknown time'}
                          </p>

                          {/* Alert Status */}
                          {lastAction && (
                            <div className="mt-2 flex items-center space-x-2">
                              <Badge variant="outline" className="text-xs">
                                {lastAction.type === 'acknowledge' && (
                                  <Check className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type === 'dismiss' && (
                                  <X className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type === 'archive' && (
                                  <Archive className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type === 'escalate' && (
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                )}
                                {lastAction.type.charAt(0).toUpperCase() +
                                  lastAction.type.slice(1)}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {new Date(lastAction.timestamp).toLocaleString()}
                              </span>
                            </div>
                          )}

                          {/* Alert Notes */}
                          {alertNotes.has(alert.alertId) && (
                            <div className="bg-muted mt-2 rounded p-2 text-sm">
                              <strong>Notes:</strong> {alertNotes.get(alert.alertId)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {!alert.acknowledged && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () =>
                                onAlertAction(alert.alertId, 'acknowledge')
                              }
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Acknowledge
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const notes = prompt('Add notes (optional):')
                                void onAlertAction(
                                  alert.alertId,
                                  'escalate',
                                  notes ?? undefined,
                                )
                              }}
                            >
                              <AlertTriangle className="mr-1 h-4 w-4" />
                              Escalate
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const notes = prompt('Add notes (optional):')
                            if (notes) {
                              onSetAlertNotes(
                                (prev) => new Map(prev.set(alert.alertId, notes)),
                              )
                            }
                          }}
                        >
                          <MessageSquare className="mr-1 h-4 w-4" />
                          Note
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => onAlertAction(alert.alertId, 'dismiss')}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Dismiss
                        </Button>
                      </div>
                    </div>

                    {/* Action History */}
                    {actions.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <details className="text-sm">
                          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                            Action History ({actions.length})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {actions.map((action) => (
                              <div
                                key={action.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span>
                                  {action.type.charAt(0).toUpperCase() + action.type.slice(1)}
                                  {action.notes && ` - ${action.notes}`}
                                </span>
                                <span className="text-muted-foreground">
                                  {new Date(action.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
