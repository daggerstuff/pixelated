 WARN  Unsupported engine: wanted: {"node":"24"} (current: {"node":"v22.17.1","pnpm":"10.15.0"})

> pixelated@0.0.1 typecheck /app
> astro check && tsc --noEmit

▶ Astro collects anonymous usage data.
  This information helps us improve Astro.
  Run "astro telemetry disable" to opt-out.
  https://astro.build/telemetry

15:55:35 [@astrojs/node] Enabling sessions with filesystem storage
15:55:36 [content] Syncing content
15:55:49 [content] Synced content
15:55:49 [types] Generated 13.52s
15:55:49 [check] Getting diagnostics for Astro files in /app...
[96msrc/components/EnhancedTodo.astro[0m:[93m839[0m:[93m56[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m839[0m     categorySelect.addEventListener('change', (_event: Event) => {
[7m   [0m [91m                                                       ~~~~~[0m
[96msrc/components/EnhancedTodo.astro[0m:[93m831[0m:[93m49[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m831[0m       button.addEventListener('click', (_event: Event) => {
[7m   [0m [91m                                                ~~~~~[0m
[96msrc/components/EnhancedTodo.astro[0m:[93m640[0m:[93m50[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m640[0m     cancelBtn.addEventListener('click', (_event: Event) => {
[7m   [0m [91m                                                 ~~~~~[0m
[96msrc/components/EnhancedTodo.astro[0m:[93m635[0m:[93m51[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m635[0m     addTodoBtn.addEventListener('click', (_event: Event) => {
[7m   [0m [91m                                                  ~~~~~[0m
[96msrc/components/EnhancedTodo.astro[0m:[93m582[0m:[93m52[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m582[0m       deleteBtn.addEventListener('click', (_event: Event) => deleteTodo(todo.id))
[7m   [0m [91m                                                   ~~~~~[0m
[96msrc/components/EnhancedTodo.astro[0m:[93m568[0m:[93m52[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m568[0m       checkbox.addEventListener('change', (_event: Event) => toggleTodoComplete(todo.id))
[7m   [0m [91m                                                   ~~~~~[0m
[96msrc/components/EnhancedTodo.astro[0m:[93m438[0m:[93m57[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m438[0m   document.addEventListener('astro:page-load', (_event: Event) => {
[7m   [0m [91m                                                        ~~~~~[0m

[96msrc/components/MentalHealthChatDemo.tsx[0m:[93m34[0m:[93m7[0m - [91merror[0m[90m ts(6133): [0m'convertInsightsToEnhanced' is declared but its value is never read.

[7m34[0m const convertInsightsToEnhanced = (insights: MentalHealthInsightsType): EnhancedMentalHealthAnalysis => {
[7m  [0m [91m      ~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/MentalHealthInsights.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { FC } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/MindMirrorDemo.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { FC } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/Navbar.astro[0m:[93m318[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'shiftKey' does not exist on type 'Event'.

[7m318[0m       if (e.shiftKey) {
[7m   [0m [91m            ~~~~~~~~[0m
[96msrc/components/Navbar.astro[0m:[93m308[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'key' does not exist on type 'Event'.

[7m308[0m       if (e.key !== 'Tab') return
[7m   [0m [91m            ~~~[0m
[96msrc/components/Navbar.astro[0m:[93m287[0m:[93m11[0m - [91merror[0m[90m ts(2339): [0mProperty 'key' does not exist on type 'Event'.

[7m287[0m         e.key === 'Escape' &&
[7m   [0m [91m          ~~~[0m

[96msrc/components/PixelatedEmpathyAgentChat.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useRef, useEffect, FC } from 'react';
[7m [0m [91m       ~~~~~[0m

[96msrc/components/ThemeSwitcher.astro[0m:[93m77[0m:[93m22[0m - [91merror[0m[90m ts(2339): [0mProperty 'matches' does not exist on type 'Event'.

[7m77[0m           setTheme(e.matches ? 'dark' : 'light')
[7m  [0m [91m                     ~~~~~~~[0m

[96msrc/components/Todo.astro[0m:[93m297[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'key' does not exist on type 'Event'.

[7m297[0m       if (e.key === 'Enter') {
[7m   [0m [91m            ~~~[0m

[96msrc/components/Todo.tsx[0m:[93m30[0m:[93m14[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'SetStateAction<TodoItem[]>'.

[7m30[0m     setTodos(loadTodos())
[7m  [0m [91m             ~~~~~~~~~~~[0m

[96msrc/components/TodoReact.tsx[0m:[93m30[0m:[93m14[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'SetStateAction<TodoItem[]>'.

[7m30[0m     setTodos(loadTodos())
[7m  [0m [91m             ~~~~~~~~~~~[0m

[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m177[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m177[0m     const { container } = await renderAstroComponent(AIChat)
[7m   [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m163[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m163[0m     const { container } = await renderAstroComponent(AIChat)
[7m   [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m144[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m144[0m     const { container } = await renderAstroComponent(AIChat, customProps)
[7m   [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m118[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m118[0m     const { container } = await renderAstroComponent(AIChat)
[7m   [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m104[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ container: HTMLDivElement; }' is not assignable to type 'void'.

[7m104[0m   return { container }
[7m   [0m [91m  ~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m98[0m:[93m66[0m - [91merror[0m[90m ts(1064): [0mThe return type of an async function or method must be the global Promise<T> type. Did you mean to write 'Promise<void>'?

[7m98[0m async function renderAstroComponent(Component: any, props = {}): void {
[7m  [0m [91m                                                                 ~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m177[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m177[0m     const { container } = await renderAstroComponent(AIChat)
[7m   [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m163[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m163[0m     const { container } = await renderAstroComponent(AIChat)
[7m   [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m144[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m144[0m     const { container } = await renderAstroComponent(AIChat, customProps)
[7m   [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/__tests__/AIChat.astro.test.ts[0m:[93m118[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m118[0m     const { container } = await renderAstroComponent(AIChat)
[7m   [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m105[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m105[0m     const { container } = await renderAstroComponent(SearchDemo)
[7m   [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m92[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m92[0m     const { container } = await renderAstroComponent(SearchDemo, customProps)
[7m  [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m73[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'container' does not exist on type 'void'.

[7m73[0m     const { container } = await renderAstroComponent(SearchDemo)
[7m  [0m [91m            ~~~~~~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m59[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ container: HTMLDivElement; }' is not assignable to type 'void'.

[7m59[0m   return { container }
[7m  [0m [91m  ~~~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m53[0m:[93m66[0m - [91merror[0m[90m ts(1064): [0mThe return type of an async function or method must be the global Promise<T> type. Did you mean to write 'Promise<void>'?

[7m53[0m async function renderAstroComponent(Component: any, props = {}): void {
[7m  [0m [91m                                                                 ~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m105[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m105[0m     const { container } = await renderAstroComponent(SearchDemo)
[7m   [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m92[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m92[0m     const { container } = await renderAstroComponent(SearchDemo, customProps)
[7m  [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/__tests__/SearchDemo.astro.test.ts[0m:[93m73[0m:[93m27[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m73[0m     const { container } = await renderAstroComponent(SearchDemo)
[7m  [0m [93m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/admin/DLPRulesManager.astro[0m:[93m144[0m:[93m36[0m - [91merror[0m[90m ts(18046): [0m'e.detail' is of type 'unknown'.

[7m144[0m       window.showDLPAlert('error', e.detail.message)
[7m   [0m [91m                                   ~~~~~~~~[0m
[96msrc/components/admin/DLPRulesManager.astro[0m:[93m139[0m:[93m17[0m - [91merror[0m[90m ts(18046): [0m'e.detail' is of type 'unknown'.

[7m139[0m         `Rule ${e.detail.isEditing ? 'updated' : 'added'} successfully`,
[7m   [0m [91m                ~~~~~~~~[0m
[96msrc/components/admin/DLPRulesManager.astro[0m:[93m128[0m:[93m36[0m - [91merror[0m[90m ts(18046): [0m'e.detail' is of type 'unknown'.

[7m128[0m         `Rule "${e.detail.name}" ${e.detail.isActive ? 'enabled' : 'disabled'}`,
[7m   [0m [91m                                   ~~~~~~~~[0m
[96msrc/components/admin/DLPRulesManager.astro[0m:[93m128[0m:[93m18[0m - [91merror[0m[90m ts(18046): [0m'e.detail' is of type 'unknown'.

[7m128[0m         `Rule "${e.detail.name}" ${e.detail.isActive ? 'enabled' : 'disabled'}`,
[7m   [0m [91m                 ~~~~~~~~[0m

[96msrc/components/admin/backup/BackupConfigurationTab.tsx[0m:[93m51[0m:[93m31[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m51[0m const BackupConfigurationTab: FC<BackupConfigurationTabProps> = ({
[7m  [0m [91m                              ~~[0m
[96msrc/components/admin/backup/BackupConfigurationTab.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/admin/backup/BackupRecoveryTab.tsx[0m:[93m95[0m:[93m26[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m95[0m const BackupRecoveryTab: FC<BackupRecoveryTabProps> = ({
[7m  [0m [91m                         ~~[0m
[96msrc/components/admin/backup/BackupRecoveryTab.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react';
[7m [0m [91m       ~~~~~[0m
[96msrc/components/admin/backup/BackupRecoveryTab.tsx[0m:[93m304[0m:[93m48[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'b' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m304[0m                   const backup = backups.find((b) => b.id === test.backupId);
[7m   [0m [93m                                               ~[0m
[96msrc/components/admin/backup/BackupRecoveryTab.tsx[0m:[93m201[0m:[93m42[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'backup' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m201[0m                   {availableBackups.map((backup) => (
[7m   [0m [93m                                         ~~~~~~[0m
[96msrc/components/admin/backup/BackupRecoveryTab.tsx[0m:[93m171[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'b' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m171[0m     (b) => b.status === 'completed' || b.status === 'verified',
[7m   [0m [93m     ~[0m
[96msrc/components/admin/backup/BackupRecoveryTab.tsx[0m:[93m113[0m:[93m40[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'b' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m113[0m   const selectedBackup = backups.find((b) => b.id === selectedBackupId);
[7m   [0m [93m                                       ~[0m

[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m71[0m:[93m24[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m71[0m const BackupReportTab: FC<BackupReportTabProps> = ({
[7m  [0m [91m                       ~~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react';
[7m [0m [91m       ~~~~~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m110[0m:[93m14[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'backup' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m110[0m     (counts, backup) => {
[7m   [0m [93m             ~~~~~~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m110[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'counts' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m110[0m     (counts, backup) => {
[7m   [0m [93m     ~~~~~~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m100[0m:[93m13[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'backup' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m100[0m     (total, backup) => total + backup.size,
[7m   [0m [93m            ~~~~~~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m100[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'total' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m100[0m     (total, backup) => total + backup.size,
[7m   [0m [93m     ~~~~~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m95[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 't' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m95[0m     (t) => t.status === RecoveryTestStatus.FAILED,
[7m  [0m [93m     ~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m92[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 't' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m92[0m     (t) => t.status === RecoveryTestStatus.PASSED,
[7m  [0m [93m     ~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m84[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'b' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m84[0m     (b) =>
[7m  [0m [93m     ~[0m
[96msrc/components/admin/backup/BackupReportTab.tsx[0m:[93m80[0m:[93m6[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'b' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m80[0m     (b) =>
[7m  [0m [93m     ~[0m

[96msrc/components/admin/backup/BackupStatusTab.tsx[0m:[93m149[0m:[93m24[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m149[0m const BackupStatusTab: FC<BackupStatusTabProps> = ({
[7m   [0m [91m                       ~~[0m
[96msrc/components/admin/backup/BackupStatusTab.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/admin/backup/BackupStatusTab.tsx[0m:[93m188[0m:[93m24[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'backup' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m188[0m           backups.map((backup) => (
[7m   [0m [93m                       ~~~~~~[0m

[96msrc/components/ai/RecommendationDisplay.tsx[0m:[93m42[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m42[0m const RecommendationDisplay: FC<RecommendationDisplayProps> = ({
[7m  [0m [91m                             ~~[0m
[96msrc/components/ai/RecommendationDisplay.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ai/RecommendationDisplay.tsx[0m:[93m108[0m:[93m29[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'baseRec' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m108[0m       {recommendations.map((baseRec) => {
[7m   [0m [93m                            ~~~~~~~[0m

[96msrc/components/ai/chat/useChatCompletion.ts[0m:[93m725[0m:[93m32[0m - [91merror[0m[90m ts(18046): [0m'parsed' is of type 'unknown'.

[7m725[0m           setConversationStats(parsed.stats)
[7m   [0m [91m                               ~~~~~~[0m
[96msrc/components/ai/chat/useChatCompletion.ts[0m:[93m724[0m:[93m13[0m - [91merror[0m[90m ts(18046): [0m'parsed' is of type 'unknown'.

[7m724[0m         if (parsed.stats) {
[7m   [0m [91m            ~~~~~~[0m
[96msrc/components/ai/chat/useChatCompletion.ts[0m:[93m723[0m:[93m21[0m - [91merror[0m[90m ts(18046): [0m'parsed' is of type 'unknown'.

[7m723[0m         setMessages(parsed.messages)
[7m   [0m [91m                    ~~~~~~[0m
[96msrc/components/ai/chat/useChatCompletion.ts[0m:[93m722[0m:[93m44[0m - [91merror[0m[90m ts(18046): [0m'parsed' is of type 'unknown'.

[7m722[0m       if (parsed.messages && Array.isArray(parsed.messages)) {
[7m   [0m [91m                                           ~~~~~~[0m
[96msrc/components/ai/chat/useChatCompletion.ts[0m:[93m722[0m:[93m11[0m - [91merror[0m[90m ts(18046): [0m'parsed' is of type 'unknown'.

[7m722[0m       if (parsed.messages && Array.isArray(parsed.messages)) {
[7m   [0m [91m          ~~~~~~[0m

[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m778[0m:[93m46[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m778[0m       applyButton.addEventListener('click', (event: Event) => {
[7m   [0m [91m                                             ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m748[0m:[93m46[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m748[0m       resetButton.addEventListener('click', (event: Event) => {
[7m   [0m [91m                                             ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m702[0m:[93m26[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'e'.

[7m702[0m           const target = e.target
[7m   [0m [91m                         ~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m701[0m:[93m46[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m701[0m         checkbox.addEventListener('change', (event: Event) => {
[7m   [0m [91m                                             ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m691[0m:[93m26[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'e'.

[7m691[0m           const target = e.target
[7m   [0m [91m                         ~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m690[0m:[93m46[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m690[0m         checkbox.addEventListener('change', (event: Event) => {
[7m   [0m [91m                                             ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m680[0m:[93m26[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'e'.

[7m680[0m           const target = e.target
[7m   [0m [91m                         ~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m679[0m:[93m46[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m679[0m         checkbox.addEventListener('change', (event: Event) => {
[7m   [0m [91m                                             ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m559[0m:[93m48[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m559[0m       endDateInput.addEventListener('change', (event: Event) => {
[7m   [0m [91m                                               ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m553[0m:[93m50[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m553[0m       startDateInput.addEventListener('change', (event: Event) => {
[7m   [0m [91m                                                 ~~~~~[0m
[96msrc/components/analytics/AdvancedFilteringComponent.astro[0m:[93m478[0m:[93m43[0m - [91merror[0m[90m ts(6133): [0m'event' is declared but its value is never read.

[7m478[0m         button.addEventListener('click', (event: MouseEvent) => {
[7m   [0m [91m                                          ~~~~~[0m

[96msrc/components/analytics/EmotionProgressDashboard.tsx[0m:[93m20[0m:[93m33[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m20[0m const EmotionProgressDashboard: FC<EmotionProgressDashboardProps> = ({
[7m  [0m [91m                                ~~[0m
[96msrc/components/analytics/EmotionProgressDashboard.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/analytics/InsightMessage.tsx[0m:[93m41[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m41[0m export const InsightMessage: FC<InsightMessageProps> = ({
[7m  [0m [91m                             ~~[0m
[96msrc/components/analytics/InsightMessage.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m114[0m:[93m47[0m - [91merror[0m[90m ts(2339): [0mProperty 'confidence' does not exist on type 'never'.

[7m114[0m                     Confidence: {(correlation.confidence * 100).toFixed(1)}%
[7m   [0m [91m                                              ~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m112[0m:[93m61[0m - [91merror[0m[90m ts(2339): [0mProperty 'description' does not exist on type 'never'.

[7m112[0m                   <div className="font-medium">{correlation.description}</div>
[7m   [0m [91m                                                            ~~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m109[0m:[93m71[0m - [91merror[0m[90m ts(2339): [0mProperty 'description' does not exist on type 'never'.

[7m109[0m                   aria-label={`Select risk correlation: ${correlation.description}`}
[7m   [0m [91m                                                                      ~~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m100[0m:[93m36[0m - [91merror[0m[90m ts(2339): [0mProperty 'id' does not exist on type 'never'.

[7m100[0m                   key={correlation.id}
[7m   [0m [91m                                   ~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m83[0m:[93m43[0m - [91merror[0m[90m ts(2339): [0mProperty 'confidence' does not exist on type 'never'.

[7m83[0m                     Confidence: {(pattern.confidence * 100).toFixed(1)}%
[7m  [0m [91m                                          ~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m81[0m:[93m57[0m - [91merror[0m[90m ts(2339): [0mProperty 'description' does not exist on type 'never'.

[7m81[0m                   <div className="font-medium">{pattern.description}</div>
[7m  [0m [91m                                                        ~~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m78[0m:[93m72[0m - [91merror[0m[90m ts(2339): [0mProperty 'description' does not exist on type 'never'.
