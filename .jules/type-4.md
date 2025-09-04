
[7m32[0m     const levels = [...new Set(scenarios.map((s) => s.riskLevel))]
[7m  [0m [93m                                              ~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m27[0m:[93m45[0m - [93mwarning[0m[90m ts(7044): [0mParameter 's' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m27[0m     const cats = [...new Set(scenarios.map((s) => s.category))]
[7m  [0m [93m                                            ~[0m

[96msrc/components/demos/bias-detection/SessionInputForm.tsx[0m:[93m19[0m:[93m32[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m19[0m export const SessionInputForm: FC<SessionInputFormProps> = ({
[7m  [0m [91m                               ~~[0m

[96msrc/components/documentation/ExportToEHR.tsx[0m:[93m193[0m:[93m20[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'ReactNode'.

[7m193[0m                    {typeof exportResult === 'object' &&
[7m   [0m [91m                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m194[0m                      'documentUrl' in exportResult &&
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m205[0m                        </div>
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m206[0m                      )}
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/documentation/ExportToEHR.tsx[0m:[93m186[0m:[93m20[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'ReactNode'.

[7m186[0m                    {typeof exportResult === 'object' &&
[7m   [0m [91m                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m187[0m                      'documentId' in exportResult &&
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m191[0m                        </p>
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m192[0m                      )}
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/documentation/ExportToEHR.tsx[0m:[93m177[0m:[93m35[0m - [91merror[0m[90m ts(2551): [0mProperty 'error' does not exist on type 'EHRExportResult'. Did you mean 'errors'?

[7m177[0m                     {exportResult.error}
[7m   [0m [91m                                  ~~~~~[0m
[96msrc/components/documentation/ExportToEHR.tsx[0m:[93m175[0m:[93m31[0m - [91merror[0m[90m ts(2551): [0mProperty 'error' does not exist on type 'EHRExportResult'. Did you mean 'errors'?

[7m175[0m                 {exportResult.error && (
[7m   [0m [91m                              ~~~~~[0m

[96msrc/components/layout/Header.astro[0m:[93m116[0m:[93m44[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m116[0m     document.addEventListener('click', (e: Event) => {
[7m   [0m [91m                                           ~~~~~[0m
[96msrc/components/layout/Header.astro[0m:[93m103[0m:[93m57[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m103[0m     mobileMenuButton.addEventListener('click', (_event: Event) => {
[7m   [0m [91m                                                        ~~~~~[0m

[96msrc/components/layout/HeaderReact.tsx[0m:[93m2[0m:[93m29[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../ui/ThemeToggle' or its corresponding type declarations.

[7m2[0m import { ThemeToggle } from '../ui/ThemeToggle'
[7m [0m [91m                            ~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/layout/ResponsiveGrid.astro[0m:[93m215[0m:[93m9[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m215[0m <script define:vars={{ columns, minCardWidth, breakpoints: defaultBreakpoints }}
[7m   [0m [93m        ~~~~~~~~~~~[0m

[96msrc/components/marketing/HeroTabs.astro[0m:[93m91[0m:[93m65[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m91[0m   tabs.forEach((t, idx) => t.addEventListener('click', (_event: Event) => { setActive(idx); start(); }));
[7m  [0m [91m                                                                ~~~~~[0m

[96msrc/components/media/BackgroundImage.astro[0m:[93m3[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'ImageMetadata'.

[7m3[0m import type { ImageMetadata } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~~[0m

[96msrc/components/media/CMSImage.astro[0m:[93m63[0m:[93m8[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'bp' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m63[0m       (bp) =>
[7m  [0m [93m       ~~[0m

[96msrc/components/media/OptimizedImage.astro[0m:[93m3[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'ImageMetadata'.

[7m3[0m import type { ImageMetadata } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~~[0m

[96msrc/components/media/ResponsiveImage.astro[0m:[93m3[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'ImageMetadata'.

[7m3[0m import type { ImageMetadata } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~~[0m

[96msrc/components/memory/MemoryDashboard.tsx[0m:[93m607[0m:[93m48[0m - [91merror[0m[90m ts(2339): [0mProperty 'deleteMemory' does not exist on type 'void'.

[7m607[0m                           pref.id && userPrefs.deleteMemory(pref.id)
[7m   [0m [91m                                               ~~~~~~~~~~~~[0m
[96msrc/components/memory/MemoryDashboard.tsx[0m:[93m597[0m:[93m30[0m - [91merror[0m[90m ts(2339): [0mProperty 'memories' does not exist on type 'void'.

[7m597[0m                   {userPrefs.memories.map((pref) => (
[7m   [0m [91m                             ~~~~~~~~[0m
[96msrc/components/memory/MemoryDashboard.tsx[0m:[93m593[0m:[93m26[0m - [91merror[0m[90m ts(2339): [0mProperty 'memories' does not exist on type 'void'.

[7m593[0m               {userPrefs.memories.length === 0 ? (
[7m   [0m [91m                         ~~~~~~~~[0m
[96msrc/components/memory/MemoryDashboard.tsx[0m:[93m597[0m:[93m44[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'pref' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m597[0m                   {userPrefs.memories.map((pref) => (
[7m   [0m [93m                                           ~~~~[0m

[96msrc/components/monitoring/AIPerformanceDashboard.astro[0m:[93m689[0m:[93m58[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m689[0m   document.addEventListener('astro:after-swap', (_event: Event) => {
[7m   [0m [91m                                                         ~~~~~[0m
[96msrc/components/monitoring/AIPerformanceDashboard.astro[0m:[93m674[0m:[93m58[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m674[0m   document.addEventListener('DOMContentLoaded', (_event: Event) => {
[7m   [0m [91m                                                         ~~~~~[0m
[96msrc/components/monitoring/AIPerformanceDashboard.astro[0m:[93m648[0m:[93m49[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m648[0m       button.addEventListener('click', (_event: Event) => {
[7m   [0m [91m                                                ~~~~~[0m
[96msrc/components/monitoring/AIPerformanceDashboard.astro[0m:[93m260[0m:[93m3[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m260[0m   define:vars={{
[7m   [0m [93m  ~~~~~~~~~~~[0m

[96msrc/components/monitoring/AuditDashboard.tsx[0m:[93m3[0m:[93m26[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../ui/charts/PieChart' or its corresponding type declarations.

[7m3[0m import { PieChart } from '../ui/charts/PieChart'
[7m [0m [91m                         ~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/monitoring/AuditDashboard.tsx[0m:[93m2[0m:[93m27[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../ui/charts/LineChart' or its corresponding type declarations.

[7m2[0m import { LineChart } from '../ui/charts/LineChart'
[7m [0m [91m                          ~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/monitoring/RealUserMonitoring.astro[0m:[93m11[0m:[93m3[0m - [91merror[0m[90m ts(6133): [0m'refreshInterval' is declared but its value is never read.

[7m11[0m   refreshInterval = 60000,
[7m  [0m [91m  ~~~~~~~~~~~~~~~[0m

[96msrc/components/monitoring/WebPerformanceDashboard.astro[0m:[93m13[0m:[93m7[0m - [91merror[0m[90m ts(6133): [0m'config' is declared but its value is never read.

[7m13[0m const config = getMonitoringConfig()
[7m  [0m [91m      ~~~~~~[0m
[96msrc/components/monitoring/WebPerformanceDashboard.astro[0m:[93m3[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'getPerformanceIndicator' is declared but its value is never read.

[7m3[0m import { getPerformanceIndicator } from '@/lib/monitoring/hooks'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/monitoring/WebPerformanceDashboard.astro[0m:[93m714[0m:[93m58[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m714[0m   document.addEventListener('astro:after-swap', (_event: Event) => {
[7m   [0m [91m                                                         ~~~~~[0m
[96msrc/components/monitoring/WebPerformanceDashboard.astro[0m:[93m700[0m:[93m58[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m700[0m   document.addEventListener('DOMContentLoaded', (_event: Event) => {
[7m   [0m [91m                                                         ~~~~~[0m
[96msrc/components/monitoring/WebPerformanceDashboard.astro[0m:[93m273[0m:[93m9[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m273[0m <script define:vars={{ refreshInterval, performanceBudgets }}>
[7m   [0m [93m        ~~~~~~~~~~~[0m

[96msrc/components/monitoring/__tests__/RealUserMonitoring.astro.test.ts[0m:[93m129[0m:[93m61[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  The last overload gave the following error.

[7m129[0m     render(React.createElement(RealUserMonitoringComponent, customProps))
[7m   [0m [91m                                                            ~~~~~~~~~~~[0m

[96msrc/components/pages/EmotionProgressDemo.tsx[0m:[93m5[0m:[93m28[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m5[0m const EmotionProgressDemo: FC = () => {
[7m [0m [91m                           ~~[0m
[96msrc/components/pages/EmotionProgressDemo.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/pages/EmotionVisualizationDemo.tsx[0m:[93m7[0m:[93m33[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m7[0m const EmotionVisualizationDemo: FC = () => {
[7m [0m [91m                                ~~[0m

[96msrc/components/pages/EmotionVisualizationPage.tsx[0m:[93m6[0m:[93m33[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m6[0m const EmotionVisualizationPage: FC = () => {
[7m [0m [91m                                ~~[0m

[96msrc/components/patient/PatientFileViewer.tsx[0m:[93m3[0m:[93m35[0m - [91merror[0m[90m ts(6133): [0m'_patientModel' is declared but its value is never read.

[7m3[0m export function PatientFileViewer({
[7m [0m [91m                                  ~[0m
[7m4[0m   _patientModel,
[7m [0m [91m~~~~~~~~~~~~~~~~[0m
[7m5[0m }: {
[7m [0m [91m~[0m

[96msrc/components/security/AuditLogDashboard.tsx[0m:[93m50[0m:[93m14[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m50[0m const Table: FC<React.PropsWithChildren> = ({ children }) => {
[7m  [0m [91m             ~~[0m

[96msrc/components/security/FHEDemo.astro[0m:[93m10[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'CardFooter' is declared but its value is never read.

[7m10[0m import CardFooter from '@/components/ui/CardFooter.astro';
[7m  [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/security/FHEDemo.astro[0m:[93m270[0m:[93m5[0m - [91merror[0m[90m ts(6133): [0m'encrypted' is declared but its value is never read.

[7m270[0m     encrypted: string,
[7m   [0m [91m    ~~~~~~~~~[0m

[96msrc/components/security/SecurityDashboard.astro[0m:[93m231[0m:[93m9[0m - [91merror[0m[90m ts(6133): [0m'mockStats' is declared but its value is never read.

[7m231[0m   const mockStats: SecurityStats = {
[7m   [0m [91m        ~~~~~~~~~[0m

[96msrc/components/security/__tests__/SecurityDashboard.test.ts[0m:[93m74[0m:[93m23[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Record<string, any>) => any' is not assignable to parameter of type 'AstroComponent'.

[7m74[0m     await renderAstro(SecurityDashboard)
[7m  [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/security/__tests__/SecurityDashboard.test.ts[0m:[93m65[0m:[93m23[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Record<string, any>) => any' is not assignable to parameter of type 'AstroComponent'.

[7m65[0m     await renderAstro(SecurityDashboard)
[7m  [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/security/__tests__/SecurityDashboard.test.ts[0m:[93m57[0m:[93m22[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'HTMLElement | undefined' is not assignable to parameter of type 'Document | Node | Element | Window'.
  Type 'undefined' is not assignable to type 'Document | Node | Element | Window'.

[7m57[0m     fireEvent.change(severitySelect, { target: { value: 'high' } })
[7m  [0m [91m                     ~~~~~~~~~~~~~~[0m
[96msrc/components/security/__tests__/SecurityDashboard.test.ts[0m:[93m51[0m:[93m23[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Record<string, any>) => any' is not assignable to parameter of type 'AstroComponent'.

[7m51[0m     await renderAstro(SecurityDashboard)
[7m  [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/security/__tests__/SecurityDashboard.test.ts[0m:[93m37[0m:[93m23[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Record<string, any>) => any' is not assignable to parameter of type 'AstroComponent'.

[7m37[0m     await renderAstro(SecurityDashboard)
[7m  [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/security/__tests__/SecurityDashboard.test.ts[0m:[93m17[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Record<string, any>) => any' is not assignable to parameter of type 'AstroComponent'.

[7m17[0m     const { container } = await renderAstro(SecurityDashboard)
[7m  [0m [91m                                            ~~~~~~~~~~~~~~~~~[0m

[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m211[0m:[93m12[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'TemporalEmotionAnalysis' to type '{ transitions: unknown[]; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'transitions' is missing in type 'TemporalEmotionAnalysis' but required in type '{ transitions: unknown[]; }'.

[7m211[0m         ? (data as { transitions: unknown[] }).transitions.length
[7m   [0m [91m           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m208[0m:[93m12[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'TemporalEmotionAnalysis' to type '{ criticalPoints: unknown[]; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'criticalPoints' is missing in type 'TemporalEmotionAnalysis' but required in type '{ criticalPoints: unknown[]; }'.

[7m208[0m         ? (data as { criticalPoints: unknown[] }).criticalPoints.length
[7m   [0m [91m           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m164[0m:[93m11[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'TemporalEmotionAnalysis' to type '{ dimensionalRelationships: unknown[]; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'dimensionalRelationships' is missing in type 'TemporalEmotionAnalysis' but required in type '{ dimensionalRelationships: unknown[]; }'.

[7m164[0m       ? ((data as { dimensionalRelationships: unknown[] }).dimensionalRelationships).map((rel) => {
[7m   [0m [91m          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m142[0m:[93m15[0m - [91merror[0m[90m ts(2365): [0mOperator '>=' cannot be applied to types '{}' and 'number'.

[7m142[0m         fill: (progression?.['negativeEmotionChange'] || 0) >= 0 ? '#8b5cf6' : '#6366f1',
[7m   [0m [91m              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m137[0m:[93m15[0m - [91merror[0m[90m ts(2365): [0mOperator '>=' cannot be applied to types '{}' and 'number'.

[7m137[0m         fill: (progression?.['positiveEmotionChange'] || 0) >= 0 ? '#4ade80' : '#f59e0b',
[7m   [0m [91m              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m132[0m:[93m15[0m - [91merror[0m[90m ts(2365): [0mOperator '>=' cannot be applied to types '{}' and 'number'.

[7m132[0m         fill: (progression?.['stabilityChange'] || 0) >= 0 ? '#3b82f6' : '#f97316',
[7m   [0m [91m              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m127[0m:[93m15[0m - [91merror[0m[90m ts(2365): [0mOperator '>=' cannot be applied to types '{}' and 'number'.

[7m127[0m         fill: (progression?.['overallImprovement'] || 0) >= 0 ? '#22c55e' : '#ef4444',
[7m   [0m [91m              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m323[0m:[93m45[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'point' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m323[0m           {prepareCriticalPointsData().map((point) => (
[7m   [0m [93m                                            ~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m150[0m:[93m54[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'transition' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m150[0m     return data?.['transitions']?.slice(0, 10)?.map((transition) => ({
[7m   [0m [93m                                                     ~~~~~~~~~~[0m
[96msrc/components/session/EmotionTemporalAnalysisChart.tsx[0m:[93m108[0m:[93m43[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'point' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m108[0m     return data?.['criticalPoints']?.map((point) => ({
[7m   [0m [93m                                          ~~~~~[0m

[96msrc/components/session/EmotionTrackingChart.tsx[0m:[93m191[0m:[93m30[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'label' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m191[0m             labelFormatter={(label) => new Date(label).toLocaleTimeString()}
[7m   [0m [93m                             ~~~~~[0m
[96msrc/components/session/EmotionTrackingChart.tsx[0m:[93m183[0m:[93m32[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'name' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m183[0m             formatter={(value, name) => {
[7m   [0m [93m                               ~~~~[0m
[96msrc/components/session/EmotionTrackingChart.tsx[0m:[93m183[0m:[93m25[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'value' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m183[0m             formatter={(value, name) => {
[7m   [0m [93m                        ~~~~~[0m
[96msrc/components/session/EmotionTrackingChart.tsx[0m:[93m173[0m:[93m29[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'tick' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m173[0m             tickFormatter={(tick) =>
[7m   [0m [93m                            ~~~~[0m

[96msrc/components/session/MultidimensionalEmotionChart.tsx[0m:[93m177[0m:[93m13[0m - [91merror[0m[90m ts(6133): [0m'_initialObjectPool' is declared but its value is never read.

[7m177[0m       const _initialObjectPool = objectPoolRef.current
[7m   [0m [91m            ~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/MultidimensionalEmotionChart.tsx[0m:[93m176[0m:[93m13[0m - [91merror[0m[90m ts(6133): [0m'_initialScene' is declared but its value is never read.

[7m176[0m       const _initialScene = sceneRef.current
[7m   [0m [91m            ~~~~~~~~~~~~~[0m
[96msrc/components/session/MultidimensionalEmotionChart.tsx[0m:[93m175[0m:[93m13[0m - [91merror[0m[90m ts(6133): [0m'_initialControls' is declared but its value is never read.

[7m175[0m       const _initialControls = controlsRef.current
[7m   [0m [91m            ~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/MultidimensionalEmotionChart.tsx[0m:[93m174[0m:[93m13[0m - [91merror[0m[90m ts(6133): [0m'_initialRenderer' is declared but its value is never read.

[7m174[0m       const _initialRenderer = rendererRef.current
[7m   [0m [91m            ~~~~~~~~~~~~~~~~[0m

[96msrc/components/session/SessionAnalysis.tsx[0m:[93m92[0m:[93m49[0m - [91merror[0m[90m ts(2339): [0mProperty 'dominantEmotion' does not exist on type 'EmotionApiItem'.

[7m92[0m                 ? { ...baseData, label: `${item.dominantEmotion}` }
[7m  [0m [91m                                                ~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m91[0m:[93m27[0m - [91merror[0m[90m ts(2339): [0mProperty 'dominantEmotion' does not exist on type 'EmotionApiItem'.

[7m91[0m               return item.dominantEmotion
[7m  [0m [91m                          ~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m26[0m:[93m3[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'useEffect'.

[7m26[0m   useEffect(() => {
[7m  [0m [91m  ~~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m24[0m:[93m41[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'useState'.

[7m24[0m   const [emotionData, setEmotionData] = useState<EmotionDataPoint[]>([])
[7m  [0m [91m                                        ~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m23[0m:[93m29[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'useState'.

[7m23[0m   const [error, setError] = useState<string | null>(null)
[7m  [0m [91m                            ~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m22[0m:[93m37[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'useState'.

[7m22[0m   const [isLoading, setIsLoading] = useState(true)
[7m  [0m [91m                                    ~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m1[0m:[93m28[0m - [91merror[0m[90m ts(6133): [0m'useSessionAnalytics' is declared but its value is never read.

[7m1[0m import { EmotionDataPoint, useSessionAnalytics } from '../../hooks/useSessionAnalytics'
[7m [0m [91m                           ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionAnalysis.tsx[0m:[93m1[0m:[93m10[0m - [91merror[0m[90m ts(2459): [0mModule '"../../hooks/useSessionAnalytics"' declares 'EmotionDataPoint' locally, but it is not exported.

[7m1[0m import { EmotionDataPoint, useSessionAnalytics } from '../../hooks/useSessionAnalytics'
[7m [0m [91m         ~~~~~~~~~~~~~~~~[0m

[96msrc/components/session/SessionDocumentation.tsx[0m:[93m784[0m:[93m25[0m - [91merror[0m[90m ts(2698): [0mSpread types may only be created from object types.

[7m784[0m                         ...editableDocumentation.treatmentProgress,
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m780[0m:[93m63[0m - [91merror[0m[90m ts(2339): [0mProperty 'overallAssessment' does not exist on type 'string'.

[7m780[0m                       editableDocumentation.treatmentProgress.overallAssessment
[7m   [0m [91m                                                              ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m780[0m:[93m23[0m - [91merror[0m[90m ts(18048): [0m'editableDocumentation.treatmentProgress' is possibly 'undefined'.

[7m780[0m                       editableDocumentation.treatmentProgress.overallAssessment
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m762[0m:[93m25[0m - [91merror[0m[90m ts(2698): [0mSpread types may only be created from object types.

[7m762[0m                         ...editableDocumentation.treatmentProgress,
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m753[0m:[93m68[0m - [91merror[0m[90m ts(2339): [0mProperty 'goals' does not exist on type 'string'.

[7m753[0m                         ...editableDocumentation.treatmentProgress.goals,
[7m   [0m [91m                                                                   ~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m753[0m:[93m28[0m - [91merror[0m[90m ts(18048): [0m'editableDocumentation.treatmentProgress' is possibly 'undefined'.

[7m753[0m                         ...editableDocumentation.treatmentProgress.goals,
[7m   [0m [91m                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m735[0m:[93m33[0m - [91merror[0m[90m ts(2698): [0mSpread types may only be created from object types.

[7m735[0m                                 ...editableDocumentation.treatmentProgress,
[7m   [0m [91m                                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m727[0m:[93m36[0m - [91merror[0m[90m ts(2339): [0mProperty 'goals' does not exist on type 'string'.

[7m727[0m                                   .goals,
[7m   [0m [91m                                   ~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m726[0m:[93m36[0m - [91merror[0m[90m ts(18048): [0m'editableDocumentation.treatmentProgress' is possibly 'undefined'.

[7m726[0m                                 ...editableDocumentation.treatmentProgress
[7m   [0m [91m                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m700[0m:[93m33[0m - [91merror[0m[90m ts(2698): [0mSpread types may only be created from object types.

[7m700[0m                                 ...editableDocumentation.treatmentProgress,
[7m   [0m [91m                                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
