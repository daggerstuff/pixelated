/**
 * BiasDashboard.components.tsx — barrel re-exporting the presentational
 * components, grouped by concern across .charts/.controls/.alerts/.dialogs.
 */
export {
  CustomTooltip,
  SummaryCards,
  TrendsTab,
  DemographicsTab,
} from './BiasDashboard.components.charts'
export {
  Header,
  NotificationSettingsPanel,
  FilteringControls,
} from './BiasDashboard.components.controls'
export {
  HighBiasAlertNotification,
  AccessibilitySkipLinks,
  CriticalAlerts,
  AlertsTab,
} from './BiasDashboard.components.alerts'
export {
  ExportDialog,
  SessionsTab,
  RecommendationsTab,
} from './BiasDashboard.components.dialogs'

export type {
  SummaryCardsProps,
  TrendsTabProps,
  DemographicsTabProps,
} from './BiasDashboard.components.charts'
export type {
  HeaderProps,
  ConnectionStatusDisplay,
  NotificationSettingsPanelProps,
  FilteringControlsProps,
} from './BiasDashboard.components.controls'
export type {
  HighBiasAlertNotificationProps,
  AccessibilitySkipLinksProps,
  CriticalAlertsProps,
  AlertsTabProps,
} from './BiasDashboard.components.alerts'
export type {
  ExportDialogProps,
  SessionsTabProps,
  RecommendationsTabProps,
} from './BiasDashboard.components.dialogs'
