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

[7m78[0m                   aria-label={`Select cross-session pattern: ${pattern.description}`}
[7m  [0m [91m                                                                       ~~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m69[0m:[93m32[0m - [91merror[0m[90m ts(2339): [0mProperty 'id' does not exist on type 'never'.

[7m69[0m                   key={pattern.id}
[7m  [0m [91m                               ~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m52[0m:[93m28[0m - [91merror[0m[90m ts(2339): [0mProperty 'indicators' does not exist on type 'never'.

[7m52[0m                     {trend.indicators.join(', ')}
[7m  [0m [91m                           ~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m49[0m:[93m41[0m - [91merror[0m[90m ts(2339): [0mProperty 'confidence' does not exist on type 'never'.

[7m49[0m                     Confidence: {(trend.confidence * 100).toFixed(1)}%
[7m  [0m [91m                                        ~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m47[0m:[93m55[0m - [91merror[0m[90m ts(2339): [0mProperty 'description' does not exist on type 'never'.

[7m47[0m                   <div className="font-medium">{trend.description}</div>
[7m  [0m [91m                                                      ~~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m44[0m:[93m62[0m - [91merror[0m[90m ts(2339): [0mProperty 'description' does not exist on type 'never'.

[7m44[0m                   aria-label={`Select trend pattern: ${trend.description}`}
[7m  [0m [91m                                                             ~~~~~~~~~~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m35[0m:[93m30[0m - [91merror[0m[90m ts(2339): [0mProperty 'id' does not exist on type 'never'.

[7m35[0m                   key={trend.id}
[7m  [0m [91m                             ~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m17[0m:[93m36[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m17[0m export const PatternVisualization: FC<PatternVisualizationProps> = ({
[7m  [0m [91m                                   ~~[0m
[96msrc/components/analytics/PatternVisualizationReact.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/analytics/PercentileBar.tsx[0m:[93m8[0m:[93m29[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m8[0m export const PercentileBar: FC<PercentileBarProps> = ({
[7m [0m [91m                            ~~[0m
[96msrc/components/analytics/PercentileBar.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/analytics/ProgressDataDisplay.tsx[0m:[93m13[0m:[93m35[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m13[0m export const ProgressDataDisplay: FC<ProgressDataDisplayProps> = ({
[7m  [0m [91m                                  ~~[0m

[96msrc/components/analytics/TreatmentForecastForm.tsx[0m:[93m32[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m32[0m const TreatmentForecastForm: FC = () => {
[7m  [0m [91m                             ~~[0m

[96msrc/components/auth/__tests__/RegisterForm.test.tsx[0m:[93m17[0m:[93m6[0m - [91merror[0m[90m ts(2571): [0mObject is of type 'unknown'.

[7m17[0m     ;(useAuth as unknown).mockImplementation(() => ({
[7m  [0m [91m     ~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/backgrounds/Dot.astro[0m:[93m11[0m:[93m9[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m11[0m <script type="module">
[7m  [0m [93m        ~~~~[0m

[96msrc/components/backgrounds/GradientAnimation.astro[0m:[93m160[0m:[93m26[0m - [91merror[0m[90m ts(2339): [0mProperty 'clientY' does not exist on type 'Event'.

[7m160[0m         const mouseY = e.clientY / window.innerHeight
[7m   [0m [91m                         ~~~~~~~[0m
[96msrc/components/backgrounds/GradientAnimation.astro[0m:[93m159[0m:[93m26[0m - [91merror[0m[90m ts(2339): [0mProperty 'clientX' does not exist on type 'Event'.

[7m159[0m         const mouseX = e.clientX / window.innerWidth
[7m   [0m [91m                         ~~~~~~~[0m

[96msrc/components/backgrounds/Particle.astro[0m:[93m11[0m:[93m9[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m11[0m <script type="module">
[7m  [0m [93m        ~~~~[0m

[96msrc/components/backgrounds/Plum.astro[0m:[93m83[0m:[93m40[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'number | undefined' is not assignable to parameter of type 'number'.
  Type 'undefined' is not assignable to type 'number'.

[7m83[0m           pendingSteps.push(() => step(nx, ny, rad2, counter || { value: 0 }))
[7m  [0m [91m                                       ~~[0m
[96msrc/components/backgrounds/Plum.astro[0m:[93m80[0m:[93m40[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'number | undefined' is not assignable to parameter of type 'number'.
  Type 'undefined' is not assignable to type 'number'.

[7m80[0m           pendingSteps.push(() => step(nx, ny, rad1, counter || { value: 0 }))
[7m  [0m [91m                                       ~~[0m
[96msrc/components/backgrounds/Plum.astro[0m:[93m71[0m:[93m59[0m - [91merror[0m[90m ts(18048): [0m'ny' is possibly 'undefined'.

[7m71[0m         if (nx < -100 || nx > width + 100 || ny < -100 || ny > height + 100)
[7m  [0m [91m                                                          ~~[0m
[96msrc/components/backgrounds/Plum.astro[0m:[93m71[0m:[93m46[0m - [91merror[0m[90m ts(18048): [0m'ny' is possibly 'undefined'.

[7m71[0m         if (nx < -100 || nx > width + 100 || ny < -100 || ny > height + 100)
[7m  [0m [91m                                             ~~[0m
[96msrc/components/backgrounds/Plum.astro[0m:[93m71[0m:[93m26[0m - [91merror[0m[90m ts(18048): [0m'nx' is possibly 'undefined'.

[7m71[0m         if (nx < -100 || nx > width + 100 || ny < -100 || ny > height + 100)
[7m  [0m [91m                         ~~[0m
[96msrc/components/backgrounds/Plum.astro[0m:[93m71[0m:[93m13[0m - [91merror[0m[90m ts(18048): [0m'nx' is possibly 'undefined'.

[7m71[0m         if (nx < -100 || nx > width + 100 || ny < -100 || ny > height + 100)
[7m  [0m [91m            ~~[0m
[96msrc/components/backgrounds/Plum.astro[0m:[93m66[0m:[93m20[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 2, '(x: number, y: number): void', gave the following error.
  Overload 2 of 2, '(x: number, y: number): void', gave the following error.

[7m66[0m         ctx.lineTo(nx, ny)
[7m  [0m [91m                   ~~[0m

[96msrc/components/base/Backdrop.astro[0m:[93m61[0m:[93m68[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'Event' is not assignable to parameter of type 'KeyboardEvent'.
  Type 'Event' is missing the following properties from type 'KeyboardEvent': altKey, charCode, code, ctrlKey, and 17 more.

[7m61[0m   document.addEventListener('keyup', (event: Event) => handleKeyUp(event))
[7m  [0m [91m                                                                   ~~~~~[0m

[96msrc/components/base/__tests__/ErrorBoundary.test.ts[0m:[93m68[0m:[93m49[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m68[0m     const { querySelector } = await renderAstro(ErrorBoundary)
[7m  [0m [91m                                                ~~~~~~~~~~~~~[0m
[96msrc/components/base/__tests__/ErrorBoundary.test.ts[0m:[93m45[0m:[93m49[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m45[0m     const { querySelector } = await renderAstro(ErrorBoundary)
[7m  [0m [91m                                                ~~~~~~~~~~~~~[0m
[96msrc/components/base/__tests__/ErrorBoundary.test.ts[0m:[93m3[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'AstroComponent'.

[7m3[0m import type { AstroComponent } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~~~[0m

[96msrc/components/chat/BrutalistChatDemo.tsx[0m:[93m27[0m:[93m9[0m - [91merror[0m[90m ts(6133): [0m'_personaContext' is declared but its value is never read.

[7m27[0m   const _personaContext = getPersonaContext(personaConfig);
[7m  [0m [91m        ~~~~~~~~~~~~~~~[0m

[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m402[0m:[93m25[0m - [91merror[0m[90m ts(2339): [0mProperty 'name' does not exist on type 'never'.

[7m402[0m               name: msg.name,
[7m   [0m [91m                        ~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m401[0m:[93m28[0m - [91merror[0m[90m ts(2339): [0mProperty 'content' does not exist on type 'never'.

[7m401[0m               content: msg.content,
[7m   [0m [91m                           ~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m400[0m:[93m25[0m - [91merror[0m[90m ts(2339): [0mProperty 'role' does not exist on type 'never'.

[7m400[0m               role: msg.role,
[7m   [0m [91m                        ~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m233[0m:[93m12[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'enableAnalysisToggle'.

[7m233[0m           {enableAnalysisToggle && (
[7m   [0m [91m           ~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m87[0m:[93m32[0m - [91merror[0m[90m ts(2339): [0mProperty 'then' does not exist on type 'string | Promise<string>'.
  Property 'then' does not exist on type 'string'.

[7m87[0m       getConversationSummary().then(setConversationSummary)
[7m  [0m [91m                               ~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m81[0m:[93m19[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'void' to type '{ memoryStats?: object | undefined; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

[7m81[0m     memoryStats: (chatHook as { memoryStats?: object })?.memoryStats || {},
[7m  [0m [91m                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m80[0m:[93m30[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'void' to type '{ getConversationSummary?: (() => Promise<string>) | undefined; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

[7m80[0m     getConversationSummary: (chatHook as { getConversationSummary?: () => Promise<string> })?.getConversationSummary || (() => ''),
[7m  [0m [91m                             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m79[0m:[93m26[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'void' to type '{ regenerateResponse?: (() => void) | undefined; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

[7m79[0m     regenerateResponse: (chatHook as { regenerateResponse?: () => void })?.regenerateResponse || (() => {}),
[7m  [0m [91m                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m78[0m:[93m21[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'void' to type '{ clearMessages?: (() => void) | undefined; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

[7m78[0m     clearMessages: (chatHook as { clearMessages?: () => void })?.clearMessages || (() => {}),
[7m  [0m [91m                    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m76[0m:[93m13[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'void' to type '{ error?: string | undefined; }' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.

[7m76[0m     error: (chatHook as { error?: string })?.error,
[7m  [0m [91m            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/MemoryAwareChatSystem.tsx[0m:[93m58[0m:[93m5[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'sessionId' does not exist in type 'ChatWithMemoryOptions'.

[7m58[0m     sessionId: sessionId as string,
[7m  [0m [91m    ~~~~~~~~~[0m

[96msrc/components/chat/TherapyChatClient.tsx[0m:[93m2[0m:[93m15[0m - [91merror[0m[90m ts(6196): [0m'Message' is declared but never used.

[7m2[0m import type { Message, ChatMessage as ChatMessageType } from '@/types/chat'
[7m [0m [91m              ~~~~~~~[0m

[96msrc/components/chat/TherapyChatSystem.tsx[0m:[93m396[0m:[93m9[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ role: string; content: string; }[]' is not assignable to parameter of type '{ role: "therapist" | "patient"; content: string; }[]'.
  Type '{ role: string; content: string; }' is not assignable to type '{ role: "therapist" | "patient"; content: string; }'.

[7m396[0m         typedConversationMessages,
[7m   [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyChatSystem.tsx[0m:[93m362[0m:[93m15[0m - [91merror[0m[90m ts(2367): [0mThis comparison appears to be unintentional because the types '"user" | "assistant" | "system"' and '"bot"' have no overlap.

[7m362[0m         role: msg.role === 'bot' ? 'patient' : 'therapist',
[7m   [0m [91m              ~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyChatSystem.tsx[0m:[93m307[0m:[93m9[0m - [91merror[0m[90m ts(2352): [0mConversion of type '{ role: "bot"; content: any; name: string; }' to type 'ExtendedMessage' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Types of property 'role' are incompatible.

[7m307[0m         {
[7m   [0m [91m        ~[0m
[7m308[0m           role: 'bot',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m310[0m           name: '',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~[0m
[7m311[0m         } as ExtendedMessage,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyChatSystem.tsx[0m:[93m283[0m:[93m11[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'aiResponse' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m283[0m       let aiResponse
[7m   [0m [93m          ~~~~~~~~~~[0m

[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m94[0m:[93m14[0m - [91merror[0m[90m ts(18048): [0m'currentStyle' is possibly 'undefined'.

[7m94[0m             {currentStyle.suitableFor.map((issue) => (
[7m  [0m [91m             ~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m85[0m:[93m27[0m - [91merror[0m[90m ts(2551): [0mProperty 'techniquesUsed' does not exist on type 'TherapyStyle'. Did you mean 'techniques'?

[7m85[0m             {currentStyle.techniquesUsed.map((technique) => (
[7m  [0m [91m                          ~~~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m85[0m:[93m14[0m - [91merror[0m[90m ts(18048): [0m'currentStyle' is possibly 'undefined'.

[7m85[0m             {currentStyle.techniquesUsed.map((technique) => (
[7m  [0m [91m             ~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m80[0m:[93m43[0m - [91merror[0m[90m ts(18048): [0m'currentStyle' is possibly 'undefined'.

[7m80[0m         <p className="style-description">{currentStyle.description}</p>
[7m  [0m [91m                                          ~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m79[0m:[93m14[0m - [91merror[0m[90m ts(18048): [0m'currentStyle' is possibly 'undefined'.

[7m79[0m         <h3>{currentStyle.name}</h3>
[7m  [0m [91m             ~~~~~~~~~~~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m15[0m:[93m36[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m15[0m export const TherapyStyleSelector: FC<TherapyStyleSelectorProps> = ({
[7m  [0m [91m                                   ~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react'
[7m [0m [91m       ~~~~~[0m
[96msrc/components/chat/TherapyStyleSelector.tsx[0m:[93m85[0m:[93m47[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'technique' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m85[0m             {currentStyle.techniquesUsed.map((technique) => (
[7m  [0m [93m                                              ~~~~~~~~~[0m

[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m65[0m:[93m60[0m - [91merror[0m[90m ts(2708): [0mCannot use namespace 'jest' as a value.

[7m65[0m     render(<ChatContainer messages={mapped} onSendMessage={jest.fn()} />)
[7m  [0m [91m                                                           ~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m38[0m:[93m24[0m - [91merror[0m[90m ts(2708): [0mCannot use namespace 'jest' as a value.

[7m38[0m         onSendMessage={jest.fn()}
[7m  [0m [91m                       ~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m34[0m:[93m17[0m - [91merror[0m[90m ts(2708): [0mCannot use namespace 'jest' as a value.

[7m34[0m     const spy = jest.fn(() => null)
[7m  [0m [91m                ~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m20[0m:[93m62[0m - [91merror[0m[90m ts(2708): [0mCannot use namespace 'jest' as a value.

[7m20[0m     render(<ChatContainer messages={messages} onSendMessage={jest.fn()} />)
[7m  [0m [91m                                                             ~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m14[0m:[93m3[0m - [91merror[0m[90m ts(2578): [0mUnused '@ts-expect-error' directive.

[7m14[0m   // @ts-expect-error for test
[7m  [0m [91m  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m6[0m:[93m8[0m - [91merror[0m[90m ts(2613): [0mModule '"/app/src/components/chat/ChatMessage"' has no default export. Did you mean to use 'import { ChatMessage } from "/app/src/components/chat/ChatMessage"' instead?

[7m6[0m import ChatMessage from '../ChatMessage'
[7m [0m [91m       ~~~~~~~~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m6[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'ChatMessage' is declared but its value is never read.

[7m6[0m import ChatMessage from '../ChatMessage'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m5[0m:[93m8[0m - [91merror[0m[90m ts(2613): [0mModule '"/app/src/components/chat/ChatContainer"' has no default export. Did you mean to use 'import { ChatContainer } from "/app/src/components/chat/ChatContainer"' instead?

[7m5[0m import ChatContainer from '../ChatContainer'
[7m [0m [91m       ~~~~~~~~~~~~~[0m
[96msrc/components/chat/__tests__/contract-propagation.test.tsx[0m:[93m3[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m3[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/crisis/CrisisSessionFlagsManager.tsx[0m:[93m13[0m:[93m41[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m13[0m export const CrisisSessionFlagsManager: FC<
[7m  [0m [91m                                        ~~[0m
[96msrc/components/crisis/CrisisSessionFlagsManager.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useEffect, useCallback } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m230[0m:[93m31[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m230[0m export const AnalyticsCharts: FC = () => {
[7m   [0m [91m                              ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m181[0m:[93m21[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m181[0m const SummaryStats: FC<SummaryStatsProps> = ({ data, isLoading }) => {
[7m   [0m [91m                    ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m126[0m:[93m22[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m126[0m const SkillProgress: FC<SkillProgressProps> = ({ data, isLoading }) => {
[7m   [0m [91m                     ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m86[0m:[93m21[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m86[0m const SessionChart: FC<SessionChartProps> = ({ data, isLoading }) => {
[7m  [0m [91m                    ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m53[0m:[93m26[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m53[0m const TimeRangeSelector: FC<TimeRangeSelectorProps> = ({ value, onChange }) => {
[7m  [0m [91m                         ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m30[0m:[93m21[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m30[0m const ErrorDisplay: FC<ErrorDisplayProps> = ({ error, onRetry }) => (
[7m  [0m [91m                    ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m13[0m:[93m24[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m13[0m const LoadingSkeleton: FC = () => (
[7m  [0m [91m                       ~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useCallback, useMemo } from 'react'
[7m [0m [91m       ~~~~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m207[0m:[93m18[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'stat' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m207[0m       {data.map((stat) => (
[7m   [0m [93m                 ~~~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m151[0m:[93m20[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'skill' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m151[0m         {data.map((skill) => (
[7m   [0m [93m                   ~~~~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m99[0m:[93m20[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'day' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m99[0m         {data.map((day) => (
[7m  [0m [93m                   ~~~[0m
[96msrc/components/dashboard/AnalyticsCharts.tsx[0m:[93m88[0m:[93m33[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'd' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m88[0m     return Math.max(...data.map(d => d.sessions), 1)
[7m  [0m [93m                                ~[0m

[96msrc/components/dashboard/EmotionDimensionalAnalysis.tsx[0m:[93m18[0m:[93m35[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m18[0m const EmotionDimensionalAnalysis: FC<EmotionDimensionalAnalysisProps> = ({
[7m  [0m [91m                                  ~~[0m
[96msrc/components/dashboard/EmotionDimensionalAnalysis.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useEffect } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/dashboard/MultidimensionalEmotionChart.tsx[0m:[93m17[0m:[93m37[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m17[0m const MultidimensionalEmotionChart: FC<MultidimensionalEmotionChartProps> = ({
[7m  [0m [91m                                    ~~[0m

[96msrc/components/demo/ClientFacingDemo.tsx[0m:[93m27[0m:[93m25[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m27[0m const ClientFacingDemo: FC = () => {
[7m  [0m [91m                        ~~[0m
[96msrc/components/demo/ClientFacingDemo.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/demo/ClinicalFormulationDemo.tsx[0m:[93m37[0m:[93m32[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m37[0m const ClinicalFormulationDemo: FC<ClinicalFormulationDemoProps> = ({
[7m  [0m [91m                               ~~[0m
[96msrc/components/demo/ClinicalFormulationDemo.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m150[0m:[93m26[0m - [91merror[0m[90m ts(18046): [0m'result.metadata' is of type 'unknown'.

[7m150[0m         confidenceLevel: result.metadata.confidenceScore / 100,
[7m   [0m [91m                         ~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m141[0m:[93m29[0m - [91merror[0m[90m ts(18046): [0m'result.resources' is of type 'unknown'.

[7m141[0m         emergencyResources: result.resources.crisis.map((resource: unknown) => {
[7m   [0m [91m                            ~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m140[0m:[93m27[0m - [91merror[0m[90m ts(18046): [0m'result.recommendations' is of type 'unknown'.

[7m140[0m         immediateActions: result.recommendations.immediate.map((action: unknown) => (action as { action: string }).action),
[7m   [0m [91m                          ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m136[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m136[0m                      result.assessment.substanceUse.impairment === 'moderate' ? 6 : 3
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m135[0m:[93m23[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m135[0m             severity: result.assessment.substanceUse.impairment === 'severe' ? 9 :
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m134[0m:[93m25[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m134[0m             confidence: result.assessment.substanceUse.acute ? 0.9 : 0.5,
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m133[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m133[0m             present: result.assessment.substanceUse.present,
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m125[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m125[0m                      result.assessment.agitation.severity === 'moderate' ? 6 : 3
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m124[0m:[93m23[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m124[0m             severity: result.assessment.agitation.severity === 'severe' ? 9 :
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m123[0m:[93m25[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m123[0m             confidence: result.assessment.agitation.controllable ? 0.4 : 0.8,
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m122[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m122[0m             present: result.assessment.agitation.present,
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m114[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m114[0m                      result.assessment.selfHarm.frequency === 'rare' ? 2 : 0
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m113[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m113[0m                      result.assessment.selfHarm.frequency === 'occasional' ? 5 :
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m112[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m112[0m                      result.assessment.selfHarm.frequency === 'frequent' ? 8 :
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m111[0m:[93m23[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m111[0m             severity: result.assessment.selfHarm.frequency === 'daily' ? 10 :
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m110[0m:[93m24[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m110[0m                        result.assessment.selfHarm.risk === 'moderate' ? 0.6 : 0.3,
[7m   [0m [91m                       ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m109[0m:[93m25[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m109[0m             confidence: result.assessment.selfHarm.risk === 'high' ? 0.9 :
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m108[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m108[0m             present: result.assessment.selfHarm.present,
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m105[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m105[0m                      result.assessment.suicidalIdeation.severity === 'passive' ? 4 : 0
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m104[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m104[0m                      result.assessment.suicidalIdeation.severity === 'active' ? 7 :
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m103[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m103[0m                      result.assessment.suicidalIdeation.severity === 'with_plan' ? 9 :
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m102[0m:[93m23[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m102[0m             severity: result.assessment.suicidalIdeation.severity === 'with_intent' ? 10 :
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m101[0m:[93m24[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m101[0m                        result.assessment.suicidalIdeation.severity === 'passive' ? 0.5 : 0.1,
[7m   [0m [91m                       ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m100[0m:[93m24[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m100[0m                        result.assessment.suicidalIdeation.severity === 'active' ? 0.75 :
[7m   [0m [91m                       ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m99[0m:[93m24[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m99[0m                        result.assessment.suicidalIdeation.severity === 'with_plan' ? 0.85 :
[7m  [0m [91m                       ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m98[0m:[93m25[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m98[0m             confidence: result.assessment.suicidalIdeation.severity === 'with_intent' ? 0.95 :
[7m  [0m [91m                        ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m97[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m97[0m             present: result.assessment.suicidalIdeation.present,
[7m  [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m94[0m:[93m19[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m94[0m                   result.assessment.overallRisk === 'low' ? 0.3 : 0.1,
[7m  [0m [91m                  ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m93[0m:[93m19[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m93[0m                   result.assessment.overallRisk === 'moderate' ? 0.6 :
[7m  [0m [91m                  ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m92[0m:[93m19[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m92[0m                   result.assessment.overallRisk === 'high' ? 0.8 :
[7m  [0m [91m                  ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m91[0m:[93m20[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m91[0m         riskScore: result.assessment.overallRisk === 'imminent' ? 0.95 :
[7m  [0m [91m                   ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/CrisisDetectionDemo.tsx[0m:[93m90[0m:[93m20[0m - [91merror[0m[90m ts(18046): [0m'result.assessment' is of type 'unknown'.

[7m90[0m         riskLevel: result.assessment.overallRisk,
[7m  [0m [91m                   ~~~~~~~~~~~~~~~~~[0m

[96msrc/components/demo/DemographicBalancingDisplay.tsx[0m:[93m287[0m:[93m7[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m287[0m       acc[stat.category].push(stat)
[7m   [0m [91m      ~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/DemographicBalancingDisplay.tsx[0m:[93m81[0m:[93m36[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m81[0m const DemographicBalancingDisplay: FC<DemographicBalancingDisplayProps> = ({
[7m  [0m [91m                                   ~~[0m
[96msrc/components/demo/DemographicBalancingDisplay.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useEffect } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/demo/FHEDemo.tsx[0m:[93m9[0m:[93m23[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m9[0m export const FHEDemo: FC<Props> = ({ defaultMessage = 'Your data is protected with FHE technology' }) => {
[7m [0m [91m                      ~~[0m
[96msrc/components/demo/FHEDemo.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useCallback, useMemo, useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/demo/KnowledgeParsingDemo.tsx[0m:[93m215[0m:[93m28[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'SetStateAction<AnalysisHistory[]>'.

[7m215[0m         setAnalysisHistory(JSON.parse(savedHistory) as unknown)
[7m   [0m [91m                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/demo/PresentingProblemVisualization.tsx[0m:[93m21[0m:[93m20[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m21[0m       const unit = match[2].toLowerCase()
[7m  [0m [91m                   ~~~~~~~~[0m
[96msrc/components/demo/PresentingProblemVisualization.tsx[0m:[93m20[0m:[93m28[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.

[7m20[0m       const num = parseInt(match[1])
[7m  [0m [91m                           ~~~~~~~~[0m
[96msrc/components/demo/PresentingProblemVisualization.tsx[0m:[93m9[0m:[93m39[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m9[0m const PresentingProblemVisualization: FC<
[7m [0m [91m                                      ~~[0m
[96msrc/components/demo/PresentingProblemVisualization.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/demo/__tests__/setup.ts[0m:[93m55[0m:[93m1[0m - [91merror[0m[90m ts(2322): [0mType 'Mock<() => { getPropertyValue: Mock<() => string>; }>' is not assignable to type '((elt: Element, pseudoElt?: string | null | undefined) => CSSStyleDeclaration) & ((elt: Element, pseudoElt?: string | null | undefined) => CSSStyleDeclaration)'.
  Type 'Mock<() => { getPropertyValue: Mock<() => string>; }>' is not assignable to type '(elt: Element, pseudoElt?: string | null | undefined) => CSSStyleDeclaration'.

[7m55[0m window.getComputedStyle = vi.fn(() => ({
[7m  [0m [91m~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/setup.ts[0m:[93m45[0m:[93m1[0m - [91merror[0m[90m ts(2322): [0mType 'Mock<() => { setStart: Mock<Procedure>; setEnd: Mock<Procedure>; commonAncestorContainer: HTMLDivElement; cloneContents: Mock<() => HTMLDivElement>; selectNodeContents: Mock<...>; collapse: Mock<...>; }>' is not assignable to type '() => Range'.
  Type '{ setStart: Mock<Procedure>; setEnd: Mock<Procedure>; commonAncestorContainer: HTMLDivElement; cloneContents: Mock<() => HTMLDivElement>; selectNodeContents: Mock<...>; collapse: Mock<...>; }' is missing the following properties from type 'Range': cloneRange, compareBoundaryPoints, comparePoint, createContextualFragment, and 23 more.

[7m45[0m document.createRange = vi.fn(() => ({
[7m  [0m [91m~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/demo/__tests__/integration/APIServiceIntegration.test.tsx[0m:[93m404[0m:[93m26[0m - [91merror[0m[90m ts(18048): [0m'response' is possibly 'undefined'.

[7m404[0m       const data = await response.json()
[7m   [0m [91m                         ~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/APIServiceIntegration.test.tsx[0m:[93m388[0m:[93m26[0m - [91merror[0m[90m ts(7030): [0mNot all code paths return a value.

[7m388[0m       const retryFetch = async (url: string, options: any, maxRetries = 3) => {
[7m   [0m [91m                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/APIServiceIntegration.test.tsx[0m:[93m361[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type '{ new (url: string | URL, protocols?: string | string[] | undefined): WebSocket; prototype: WebSocket; readonly CONNECTING: 0; readonly OPEN: 1; readonly CLOSING: 2; readonly CLOSED: 3; }'.

[7m361[0m       global.WebSocket = vi.fn(() => mockWebSocket) as unknown
[7m   [0m [91m      ~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/APIServiceIntegration.test.tsx[0m:[93m342[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type '{ new (url: string | URL, protocols?: string | string[] | undefined): WebSocket; prototype: WebSocket; readonly CONNECTING: 0; readonly OPEN: 1; readonly CLOSING: 2; readonly CLOSED: 3; }'.

[7m342[0m       global.WebSocket = vi.fn(() => mockWebSocket) as unknown
[7m   [0m [91m      ~~~~~~~~~~~~~~~~[0m

[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m450[0m:[93m11[0m - [91merror[0m[90m ts(2322): [0mType '{ onBalanceUpdate: (categories: any, metrics: any) => void; }' is not assignable to type 'IntrinsicAttributes & CategoryBalancingDemoProps'.
  Property 'onBalanceUpdate' does not exist on type 'IntrinsicAttributes & CategoryBalancingDemoProps'.

[7m450[0m           onBalanceUpdate={(categories, metrics) => {
[7m   [0m [91m          ~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m416[0m:[93m11[0m - [91merror[0m[90m ts(2322): [0mType '{ pipelineData: { totalItems: number; categories: { id: string; name: string; count: number; percentage: number; }[]; qualityMetrics: { overallScore: number; validationScore: number; balanceScore: number; }; processingStats: { ...; }; }; }' is not assignable to type 'IntrinsicAttributes & ResultsExportDemoProps'.
  Property 'pipelineData' does not exist on type 'IntrinsicAttributes & ResultsExportDemoProps'.

[7m416[0m           pipelineData={{
[7m   [0m [91m          ~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m402[0m:[93m11[0m - [91merror[0m[90m ts(2322): [0mType '{ onBalanceUpdate: (categories: any, metrics: any) => void; }' is not assignable to type 'IntrinsicAttributes & CategoryBalancingDemoProps'.
  Property 'onBalanceUpdate' does not exist on type 'IntrinsicAttributes & CategoryBalancingDemoProps'.

[7m402[0m           onBalanceUpdate={(categories, metrics) => {
[7m   [0m [91m          ~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m339[0m:[93m37[0m - [91merror[0m[90m ts(2322): [0mType '{ enableLiveIntegration: boolean; }' is not assignable to type 'IntrinsicAttributes & CategoryBalancingDemoProps'.
  Property 'enableLiveIntegration' does not exist on type 'IntrinsicAttributes & CategoryBalancingDemoProps'.

[7m339[0m       render(<CategoryBalancingDemo enableLiveIntegration={true} />)
[7m   [0m [91m                                    ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m329[0m:[93m23[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'HTMLElement | undefined' is not assignable to parameter of type 'Document | Node | Element | Window'.
  Type 'undefined' is not assignable to type 'Document | Node | Element | Window'.

[7m329[0m       fireEvent.click(testButtons[0])
[7m   [0m [91m                      ~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m307[0m:[93m37[0m - [91merror[0m[90m ts(2322): [0mType '{ enableLiveIntegration: boolean; }' is not assignable to type 'IntrinsicAttributes & CategoryBalancingDemoProps'.
  Property 'enableLiveIntegration' does not exist on type 'IntrinsicAttributes & CategoryBalancingDemoProps'.

[7m307[0m       render(<CategoryBalancingDemo enableLiveIntegration={true} />)
[7m   [0m [91m                                    ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m169[0m:[93m35[0m - [91merror[0m[90m ts(2322): [0mType '{ onExportComplete: Mock<Procedure>; }' is not assignable to type 'IntrinsicAttributes & ResultsExportDemoProps'.
  Property 'onExportComplete' does not exist on type 'IntrinsicAttributes & ResultsExportDemoProps'.

[7m169[0m       rerender(<ResultsExportDemo onExportComplete={mockExportCallback} />)
[7m   [0m [91m                                  ~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m120[0m:[93m39[0m - [91merror[0m[90m ts(2322): [0mType '{ onBalanceUpdate: Mock<Procedure>; }' is not assignable to type 'IntrinsicAttributes & CategoryBalancingDemoProps'.
  Property 'onBalanceUpdate' does not exist on type 'IntrinsicAttributes & CategoryBalancingDemoProps'.

[7m120[0m       rerender(<CategoryBalancingDemo onBalanceUpdate={mockBalanceCallback} />)
[7m   [0m [91m                                      ~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m19[0m:[93m1[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type '{ new (): FileReader; prototype: FileReader; readonly EMPTY: 0; readonly LOADING: 1; readonly DONE: 2; }'.

[7m19[0m global.FileReader = vi.fn(() => mockFileReader) as unknown
[7m  [0m [91m~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m4[0m:[93m28[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../../ValidationDemo' or its corresponding type declarations.

[7m4[0m import ValidationDemo from '../../ValidationDemo'
[7m [0m [91m                           ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m3[0m:[93m31[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../../DataIngestionDemo' or its corresponding type declarations.

[7m3[0m import DataIngestionDemo from '../../DataIngestionDemo'
[7m [0m [91m                              ~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m450[0m:[93m41[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'metrics' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m450[0m           onBalanceUpdate={(categories, metrics) => {
[7m   [0m [93m                                        ~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m450[0m:[93m29[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'categories' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m450[0m           onBalanceUpdate={(categories, metrics) => {
[7m   [0m [93m                            ~~~~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m402[0m:[93m41[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'metrics' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m402[0m           onBalanceUpdate={(categories, metrics) => {
[7m   [0m [93m                                        ~~~~~~~[0m
[96msrc/components/demo/__tests__/integration/PipelineIntegration.test.tsx[0m:[93m402[0m:[93m29[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'categories' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m402[0m           onBalanceUpdate={(categories, metrics) => {
[7m   [0m [93m                            ~~~~~~~~~~[0m

[96msrc/components/demos/DebounceDemoComponent.tsx[0m:[93m4[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m4[0m const DebounceDemoComponent: FC = () => {
[7m [0m [91m                             ~~[0m

[96msrc/components/demos/bias-detection/BiasAnalysisDisplay.tsx[0m:[93m14[0m:[93m35[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m14[0m export const BiasAnalysisDisplay: FC<BiasAnalysisDisplayProps> = ({
[7m  [0m [91m                                  ~~[0m
[96msrc/components/demos/bias-detection/BiasAnalysisDisplay.tsx[0m:[93m3[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m3[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/demos/bias-detection/BiasAnalysisDisplay.tsx[0m:[93m354[0m:[93m43[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'recommendation' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m354[0m             {results.recommendations.map((recommendation) => (
[7m   [0m [93m                                          ~~~~~~~~~~~~~~[0m

[96msrc/components/demos/bias-detection/BiasDetectionDemo.tsx[0m:[93m135[0m:[93m65[0m - [91merror[0m[90m ts(2554): [0mExpected 1 arguments, but got 2.

[7m135[0m         const scenarios = generateCounterfactualScenarios(data, biasFactors)
[7m   [0m [91m                                                                ~~~~~~~~~~~[0m
[96msrc/components/demos/bias-detection/BiasDetectionDemo.tsx[0m:[93m34[0m:[93m33[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m34[0m export const BiasDetectionDemo: FC<BiasDetectionDemoProps> = ({
[7m  [0m [91m                                ~~[0m
[96msrc/components/demos/bias-detection/BiasDetectionDemo.tsx[0m:[93m3[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m3[0m import React, { useState, useCallback } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/demos/bias-detection/CounterfactualAnalysis.tsx[0m:[93m14[0m:[93m38[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m14[0m export const CounterfactualAnalysis: FC<CounterfactualAnalysisProps> = ({
[7m  [0m [91m                                     ~~[0m
[96msrc/components/demos/bias-detection/CounterfactualAnalysis.tsx[0m:[93m155[0m:[93m27[0m - [93mwarning[0m[90m ts(7044): [0mParameter 's' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m155[0m                     (sum, s) => sum + Math.abs(s.biasScoreChange),
[7m   [0m [93m                          ~[0m
[96msrc/components/demos/bias-detection/CounterfactualAnalysis.tsx[0m:[93m155[0m:[93m22[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'sum' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m155[0m                     (sum, s) => sum + Math.abs(s.biasScoreChange),
[7m   [0m [93m                     ~~~[0m
[96msrc/components/demos/bias-detection/CounterfactualAnalysis.tsx[0m:[93m143[0m:[93m39[0m - [93mwarning[0m[90m ts(7044): [0mParameter 's' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m143[0m                     ...scenarios.map((s) => Math.abs(s.biasScoreChange)),
[7m   [0m [93m                                      ~[0m
[96msrc/components/demos/bias-detection/CounterfactualAnalysis.tsx[0m:[93m134[0m:[93m32[0m - [93mwarning[0m[90m ts(7044): [0mParameter 's' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m134[0m             {scenarios.filter((s) => s.likelihood === 'high').length}
[7m   [0m [93m                               ~[0m

[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m17[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m17[0m export const ExportControls: FC<ExportControlsProps> = ({
[7m  [0m [91m                             ~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m3[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m3[0m import React, { useState } from 'react'
[7m [0m [91m       ~~~~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m195[0m:[93m50[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'index' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m195[0m       counterfactualScenarios.forEach((scenario, index) => {
[7m   [0m [93m                                                 ~~~~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m195[0m:[93m40[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'scenario' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m195[0m       counterfactualScenarios.forEach((scenario, index) => {
[7m   [0m [93m                                       ~~~~~~~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m187[0m:[93m53[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'index' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m187[0m       analysisResults.recommendations.forEach((rec, index) => {
[7m   [0m [93m                                                    ~~~~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m187[0m:[93m48[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'rec' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m187[0m       analysisResults.recommendations.forEach((rec, index) => {
[7m   [0m [93m                                               ~~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m113[0m:[93m50[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'index' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m113[0m       counterfactualScenarios.forEach((scenario, index) => {
[7m   [0m [93m                                                 ~~~~~[0m
[96msrc/components/demos/bias-detection/ExportControls.tsx[0m:[93m113[0m:[93m40[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'scenario' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m113[0m       counterfactualScenarios.forEach((scenario, index) => {
[7m   [0m [93m                                       ~~~~~~~~[0m

[96msrc/components/demos/bias-detection/HistoricalProgressTracker.tsx[0m:[93m11[0m:[93m41[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m11[0m export const HistoricalProgressTracker: FC<
[7m  [0m [91m                                        ~~[0m
[96msrc/components/demos/bias-detection/HistoricalProgressTracker.tsx[0m:[93m3[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m3[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m122[0m:[93m52[0m - [91merror[0m[90m ts(18046): [0m'level' is of type 'unknown'.

[7m122[0m                   {level.charAt(0).toUpperCase() + level.slice(1)}
[7m   [0m [91m                                                   ~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m122[0m:[93m20[0m - [91merror[0m[90m ts(18046): [0m'level' is of type 'unknown'.

[7m122[0m                   {level.charAt(0).toUpperCase() + level.slice(1)}
[7m   [0m [91m                   ~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m121[0m:[93m37[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.

[7m121[0m                 <option key={level} value={level}>
[7m   [0m [91m                                    ~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m121[0m:[93m25[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'Key | null | undefined'.

[7m121[0m                 <option key={level} value={level}>
[7m   [0m [91m                        ~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m101[0m:[93m55[0m - [91merror[0m[90m ts(18046): [0m'category' is of type 'unknown'.

[7m101[0m                   {category.charAt(0).toUpperCase() + category.slice(1)}
[7m   [0m [91m                                                      ~~~~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m101[0m:[93m20[0m - [91merror[0m[90m ts(18046): [0m'category' is of type 'unknown'.

[7m101[0m                   {category.charAt(0).toUpperCase() + category.slice(1)}
[7m   [0m [91m                   ~~~~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m100[0m:[93m40[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'string | number | readonly string[] | undefined'.

[7m100[0m                 <option key={category} value={category}>
[7m   [0m [91m                                       ~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m100[0m:[93m25[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'Key | null | undefined'.

[7m100[0m                 <option key={category} value={category}>
[7m   [0m [91m                        ~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m13[0m:[93m38[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m13[0m export const PresetScenarioSelector: FC<PresetScenarioSelectorProps> = ({
[7m  [0m [91m                                     ~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m3[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m3[0m import React, { useState, useMemo } from 'react'
[7m [0m [91m       ~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m226[0m:[93m25[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'objective' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m226[0m                   .map((objective) => (
[7m   [0m [93m                        ~~~~~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m137[0m:[93m33[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'scenario' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m137[0m         {filteredScenarios.map((scenario) => (
[7m   [0m [93m                                ~~~~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m41[0m:[93m30[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'scenario' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m41[0m     return scenarios.filter((scenario) => {
[7m  [0m [93m                             ~~~~~~~~[0m
[96msrc/components/demos/bias-detection/PresetScenarioSelector.tsx[0m:[93m32[0m:[93m47[0m - [93mwarning[0m[90m ts(7044): [0mParameter 's' implicitly has an 'any' type, but a better type may be inferred from usage.

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
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m692[0m:[93m36[0m - [91merror[0m[90m ts(2339): [0mProperty 'goals' does not exist on type 'string'.

[7m692[0m                                   .goals,
[7m   [0m [91m                                   ~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m691[0m:[93m36[0m - [91merror[0m[90m ts(18048): [0m'editableDocumentation.treatmentProgress' is possibly 'undefined'.

[7m691[0m                                 ...editableDocumentation.treatmentProgress
[7m   [0m [91m                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m665[0m:[93m33[0m - [91merror[0m[90m ts(2698): [0mSpread types may only be created from object types.

[7m665[0m                                 ...editableDocumentation.treatmentProgress,
[7m   [0m [91m                                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m657[0m:[93m36[0m - [91merror[0m[90m ts(2339): [0mProperty 'goals' does not exist on type 'string'.

[7m657[0m                                   .goals,
[7m   [0m [91m                                   ~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m656[0m:[93m36[0m - [91merror[0m[90m ts(18048): [0m'editableDocumentation.treatmentProgress' is possibly 'undefined'.

[7m656[0m                                 ...editableDocumentation.treatmentProgress
[7m   [0m [91m                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m635[0m:[93m58[0m - [91merror[0m[90m ts(2339): [0mProperty 'goals' does not exist on type 'string'.

[7m635[0m                 {editableDocumentation.treatmentProgress.goals.map(
[7m   [0m [91m                                                         ~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m635[0m:[93m18[0m - [91merror[0m[90m ts(18048): [0m'editableDocumentation.treatmentProgress' is possibly 'undefined'.

[7m635[0m                 {editableDocumentation.treatmentProgress.goals.map(
[7m   [0m [91m                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m608[0m:[93m24[0m - [91merror[0m[90m ts(2488): [0mType 'readonly string[] | undefined' must have a '[Symbol.iterator]()' method that returns an iterator.

[7m608[0m                     ...editableDocumentation.therapeuticTechniques,
[7m   [0m [91m                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m549[0m:[93m29[0m - [91merror[0m[90m ts(2322): [0mType '{ description: string; name: string; effectiveness: number; }' is not assignable to type 'string'.

[7m549[0m                             newTechniques[index] = {
[7m   [0m [91m                            ~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m522[0m:[93m31[0m - [91merror[0m[90m ts(2322): [0mType '{ name: string; description: string; effectiveness: number; }' is not assignable to type 'string'.

[7m522[0m                               newTechniques[index] = {
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m497[0m:[93m17[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(technique: { name: string; description: string; effectiveness: number; }, index: number) => JSX.Element' is not assignable to parameter of type '(value: string, index: number, array: readonly string[]) => Element'.
  Types of parameters 'technique' and 'value' are incompatible.

[7m497[0m                 (
[7m   [0m [91m                ~[0m
[7m498[0m                   technique: {
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m600[0m                   </div>
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m601[0m                 ),
[7m   [0m [91m~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m213[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ technique: string; predictedEfficacy: number; confidence: number; rationale: string; }' is not assignable to type 'string'.

[7m213[0m         {
[7m   [0m [91m        ~[0m
[7m214[0m           technique: 'Cognitive Restructuring',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m218[0m             'Client is open to examining thoughts but needs more practice.',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m219[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m206[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ technique: string; predictedEfficacy: number; confidence: number; rationale: string; }' is not assignable to type 'string'.

[7m206[0m         {
[7m   [0m [91m        ~[0m
[7m207[0m           technique: 'Progressive Muscle Relaxation',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m211[0m             'Client has responded well to relaxation techniques in the past.',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m212[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m170[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType '{ goals: { description: string; progress: number; notes: string; }[]; overallAssessment: string; }' is not assignable to type 'string'.

[7m170[0m       treatmentProgress: {
[7m   [0m [91m      ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m168[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'readonly string[]'.

[7m168[0m       recommendedFollowUp:
[7m   [0m [91m      ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m162[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ pattern: string; significance: string; }' is not assignable to type 'string'.

[7m162[0m         {
[7m   [0m [91m        ~[0m
[7m163[0m           pattern: 'Work stress -> Physical tension -> Sleep disruption',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m165[0m             'Physical manifestation of stress affecting sleep quality',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m166[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m157[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ pattern: string; significance: string; }' is not assignable to type 'string'.

[7m157[0m         {
[7m   [0m [91m        ~[0m
[7m158[0m           pattern: 'Anxiety -> Self-criticism -> Avoidance',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m160[0m             'Client demonstrates recurring pattern of anxiety triggering self-critical thoughts, leading to avoidance behaviors',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m161[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m149[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ name: string; description: string; effectiveness: number; }' is not assignable to type 'string'.

[7m149[0m         {
[7m   [0m [91m        ~[0m
[7m150[0m           name: 'Mindfulness Breathing',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m153[0m           effectiveness: 6,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m154[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m143[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ name: string; description: string; effectiveness: number; }' is not assignable to type 'string'.

[7m143[0m         {
[7m   [0m [91m        ~[0m
[7m144[0m           name: 'Cognitive Restructuring',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m147[0m           effectiveness: 7,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m148[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m137[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType '{ name: string; description: string; effectiveness: number; }' is not assignable to type 'string'.

[7m137[0m         {
[7m   [0m [91m        ~[0m
[7m138[0m           name: 'Progressive Muscle Relaxation',
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m141[0m           effectiveness: 8,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m142[0m         },
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/components/session/SessionDocumentation.tsx[0m:[93m133[0m:[93m7[0m - [91merror[0m[90m ts(2740): [0mType '{}' is missing the following properties from type 'SessionMetadata': version, createdAt, updatedAt, createdBy, and 3 more.

[7m133[0m       metadata: {},
[7m   [0m [91m      ~~~~~~~~[0m

[96msrc/components/session/SessionList.astro[0m:[93m41[0m:[93m24[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'session' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m41[0m         {sessions.map((session) => (
[7m  [0m [93m                       ~~~~~~~[0m

[96msrc/components/tailus/AppHeader.astro[0m:[93m4[0m:[93m53[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@tailus/themer-button' or its corresponding type declarations.

[7m4[0m import { button, ghostButton, outlinedButton } from '@tailus/themer-button'
[7m [0m [91m                                                    ~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/tailus/BentoGrid.astro[0m:[93m4[0m:[93m45[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@tailus/themer-card' or its corresponding type declarations.

[7m4[0m import { softGradientVariant as card } from '@tailus/themer-card'
[7m [0m [91m                                            ~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/tailus/CallToAction.astro[0m:[93m5[0m:[93m40[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@tailus/themer-button' or its corresponding type declarations.

[7m5[0m import { button, outlinedButton } from '@tailus/themer-button'
[7m [0m [91m                                       ~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/tailus/HeroSection.astro[0m:[93m4[0m:[93m40[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@tailus/themer-button' or its corresponding type declarations.

[7m4[0m import { button, outlinedButton } from '@tailus/themer-button'
[7m [0m [91m                                       ~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/tailus/SpeedSection.astro[0m:[93m4[0m:[93m26[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@tailus/themer-progress' or its corresponding type declarations.

[7m4[0m import { progress } from '@tailus/themer-progress'
[7m [0m [91m                         ~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/tailus/Testimonials.astro[0m:[93m3[0m:[93m37[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@tailus/themer-card' or its corresponding type declarations.

[7m3[0m import { softVariant as card } from '@tailus/themer-card'
[7m [0m [91m                                    ~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/testing/BrowserCompatibilityTester.tsx[0m:[93m29[0m:[93m25[0m - [93mwarning[0m[90m ts(6385): [0m'vendor' is deprecated.

[7m29[0m       vendor: navigator.vendor,
[7m  [0m [93m                        ~~~~~~[0m
[96msrc/components/testing/BrowserCompatibilityTester.tsx[0m:[93m26[0m:[93m27[0m - [93mwarning[0m[90m ts(6385): [0m'platform' is deprecated.

[7m26[0m       platform: navigator.platform,
[7m  [0m [93m                          ~~~~~~~~[0m

[96msrc/components/theme/ThemeProvider.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { createContext, useContext, useEffect, useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/therapy/TherapeuticGoalsTracker.tsx[0m:[93m914[0m:[93m24[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'string | undefined' is not assignable to parameter of type 'never'.
  Type 'undefined' is not assignable to type 'never'.

[7m914[0m     interventions.push(commonInterventions[randomIndex])
[7m   [0m [91m                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/therapy/TherapeuticGoalsTracker.tsx[0m:[93m879[0m:[93m18[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ timestamp: number; progressPercent: number; notes: string; }' is not assignable to parameter of type 'never'.

[7m879[0m     history.push({
[7m   [0m [91m                 ~[0m
[7m880[0m       timestamp: now - weeksAgo * 604800000,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m885[0m           : `Continued progress on goal implementation, session ${i}`,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m886[0m     })
[7m   [0m [91m~~~~~[0m
[96msrc/components/therapy/TherapeuticGoalsTracker.tsx[0m:[93m854[0m:[93m22[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ notes?: string | undefined; completedAt?: number | undefined; id: string; description: string | undefined; isCompleted: boolean; }' is not assignable to parameter of type 'never'.

[7m854[0m     checkpoints.push({
[7m   [0m [91m                     ~[0m
[7m855[0m       id: `cp-${i + 1}`,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m859[0m       ...(isCompleted ? { notes: 'Good progress on this checkpoint' } : {}),
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m860[0m     })
[7m   [0m [91m~~~~~[0m
[96msrc/components/therapy/TherapeuticGoalsTracker.tsx[0m:[93m69[0m:[93m27[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m69[0m           setActiveGoalId(fallbackGoals[0].id)
[7m  [0m [91m                          ~~~~~~~~~~~~~~~~[0m
[96msrc/components/therapy/TherapeuticGoalsTracker.tsx[0m:[93m59[0m:[93m29[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m59[0m             setActiveGoalId(initialGoals[0].id)
[7m  [0m [91m                            ~~~~~~~~~~~~~~~[0m
[96msrc/components/therapy/TherapeuticGoalsTracker.tsx[0m:[93m52[0m:[93m29[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m52[0m             setActiveGoalId(data[0].id)
[7m  [0m [91m                            ~~~~~~~[0m

[96msrc/components/therapy/TreatmentPlanManager.tsx[0m:[93m488[0m:[93m31[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'string'.

[7m488[0m     setNewPlanData(JSON.parse(JSON.stringify(initialNewPlanData) as unknown)) // Reset with deep copy
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/therapy/TreatmentPlanManager.tsx[0m:[93m391[0m:[93m33[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'string'.

[7m391[0m       setNewPlanData(JSON.parse(JSON.stringify(initialNewPlanData) as unknown))
[7m   [0m [91m                                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/therapy/TreatmentPlanManager.tsx[0m:[93m112[0m:[93m16[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'string'.

[7m112[0m     JSON.parse(JSON.stringify(initialNewPlanData) as unknown),
[7m   [0m [91m               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/therapy/TreatmentPlanManager.tsx[0m:[93m105[0m:[93m29[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m105[0m const TreatmentPlanManager: FC = () => {
[7m   [0m [91m                            ~~[0m

[96msrc/components/three/custom/CustomSpotLight.jsx[0m:[93m2[0m:[93m23[0m - [93mwarning[0m[90m ts(7016): [0mCould not find a declaration file for module 'prop-types'. '/app/node_modules/.pnpm/prop-types@15.8.1/node_modules/prop-types/index.js' implicitly has an 'any' type.
  Try `npm i --save-dev @types/prop-types` if it exists or add a new declaration (.d.ts) file containing `declare module 'prop-types';`

[7m2[0m import PropTypes from 'prop-types'
[7m [0m [93m                      ~~~~~~~~~~~~[0m

[96msrc/components/toc/Toc.astro[0m:[93m9[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'MarkdownHeading'.

[7m9[0m import type { MarkdownHeading } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~~~~[0m
[96msrc/components/toc/Toc.astro[0m:[93m113[0m:[93m22[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'item' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m113[0m           years.map((item) => (
[7m   [0m [93m                     ~~~~[0m
[96msrc/components/toc/Toc.astro[0m:[93m103[0m:[93m25[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'item' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m103[0m           category.map((item) => (
[7m   [0m [93m                        ~~~~[0m
[96msrc/components/toc/Toc.astro[0m:[93m85[0m:[93m24[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'item' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m85[0m             years.map((item) => (
[7m  [0m [93m                       ~~~~[0m
[96msrc/components/toc/Toc.astro[0m:[93m75[0m:[93m27[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'item' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m75[0m             category.map((item) => (
[7m  [0m [93m                          ~~~~[0m
[96msrc/components/toc/Toc.astro[0m:[93m238[0m:[93m33[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'string' is not assignable to parameter of type 'never'.

[7m238[0m           : levelSelectors.push(`h${i}`)
[7m   [0m [91m                                ~~~~~~~[0m
[96msrc/components/toc/Toc.astro[0m:[93m237[0m:[93m33[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'string' is not assignable to parameter of type 'never'.

[7m237[0m           ? levelSelectors.push(`${baseSelector} h${i}`)
[7m   [0m [91m                                ~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/toc/TocButton.astro[0m:[93m58[0m:[93m78[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'Event' is not assignable to parameter of type 'MouseEvent'.
  Type 'Event' is missing the following properties from type 'MouseEvent': altKey, button, buttons, clientX, and 23 more.

[7m58[0m     tocPanel?.addEventListener('click', (event: Event) => handleClickToClose(event))
[7m  [0m [91m                                                                             ~~~~~[0m
[96msrc/components/toc/TocButton.astro[0m:[93m47[0m:[93m28[0m - [91merror[0m[90m ts(2551): [0mProperty 'targe' does not exist on type 'MouseEvent'. Did you mean 'target'?

[7m47[0m       const target = event.targe
[7m  [0m [91m                           ~~~~~[0m

[96msrc/components/toc/TocItem.astro[0m:[93m24[0m:[93m24[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'subheading' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m24[0m         {children.map((subheading) => (
[7m  [0m [93m                       ~~~~~~~~~~[0m

[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m362[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'Variant' is not assignable to type 'boolean | TargetAndTransition | VariantLabels | undefined'.
  Type 'TargetResolver' is not assignable to type 'boolean | TargetAndTransition | VariantLabels | undefined'.

[7m362[0m       initial={masterSequence?.['initial'] || {}}
[7m   [0m [91m      ~~~~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m317[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'Variant' is not assignable to type 'boolean | TargetAndTransition | VariantLabels | undefined'.
  Type 'TargetResolver' is not assignable to type 'boolean | TargetAndTransition | VariantLabels | undefined'.

[7m317[0m       initial={currentVariants['initial'] || {}}
[7m   [0m [91m      ~~~~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m301[0m:[93m28[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m301[0m       await controls.start(steps[0].variants['initial'] || {})
[7m   [0m [91m                           ~~~~~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m292[0m:[93m18[0m - [91merror[0m[90m ts(18048): [0m'step' is possibly 'undefined'.

[7m292[0m           delay: step.delay || 0,
[7m   [0m [91m                 ~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m291[0m:[93m69[0m - [91merror[0m[90m ts(18048): [0m'step' is possibly 'undefined'.

[7m291[0m           ease: typeof step.ease === 'string' ? EASING[step.ease] : step.ease,
[7m   [0m [91m                                                                    ~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m291[0m:[93m56[0m - [91merror[0m[90m ts(18048): [0m'step' is possibly 'undefined'.

[7m291[0m           ease: typeof step.ease === 'string' ? EASING[step.ease] : step.ease,
[7m   [0m [91m                                                       ~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m291[0m:[93m24[0m - [91merror[0m[90m ts(18048): [0m'step' is possibly 'undefined'.

[7m291[0m           ease: typeof step.ease === 'string' ? EASING[step.ease] : step.ease,
[7m   [0m [91m                       ~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m290[0m:[93m21[0m - [91merror[0m[90m ts(18048): [0m'step' is possibly 'undefined'.

[7m290[0m           duration: step.duration || TIMING.normal,
[7m   [0m [91m                    ~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m288[0m:[93m12[0m - [91merror[0m[90m ts(18048): [0m'step' is possibly 'undefined'.

[7m288[0m         ...step.variants['animate'],
[7m   [0m [91m           ~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m287[0m:[93m28[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ transition: { duration: number; ease: number[] | readonly [0.25, 0.1, 0.25, 1] | readonly [0.4, 0, 1, 1] | readonly [0, 0, 0.2, 1] | readonly [0.4, 0, 0.2, 1] | readonly [0.34, 1.56, 0.64, 1] | readonly [0.22, 1, 0.36, 1] | readonly [0.68, -0.55, 0.265, 1.55] | undefined; delay: number; }; ... 701 more ...; transi...' is not assignable to parameter of type 'AnimationDefinition'.
  Types of property 'transition' are incompatible.

[7m287[0m       await controls.start({
[7m   [0m [91m                           ~[0m
[7m288[0m         ...step.variants['animate'],
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m293[0m         },
[7m   [0m [91m~~~~~~~~~~[0m
[7m294[0m       })
[7m   [0m [91m~~~~~~~[0m
[96msrc/components/transitions/AnimationOrchestrator.tsx[0m:[93m81[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'Variants | undefined' is not assignable to type 'Variants'.
  Type 'undefined' is not assignable to type 'Variants'.

[7m81[0m       baseVariants = animationPresets[sequence] || animationPresets.fadeIn
[7m  [0m [91m      ~~~~~~~~~~~~[0m

[96msrc/components/transitions/PageTransitions.astro[0m:[93m60[0m:[93m22[0m - [91merror[0m[90m ts(18048): [0m'currentTransition' is possibly 'undefined'.

[7m60[0m const newTransform = currentTransition.new.transform || 'none'
[7m  [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/transitions/PageTransitions.astro[0m:[93m59[0m:[93m20[0m - [91merror[0m[90m ts(18048): [0m'currentTransition' is possibly 'undefined'.

[7m59[0m const newOpacity = currentTransition.new.opacity || '1'
[7m  [0m [91m                   ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/transitions/PageTransitions.astro[0m:[93m58[0m:[93m22[0m - [91merror[0m[90m ts(18048): [0m'currentTransition' is possibly 'undefined'.

[7m58[0m const oldTransform = currentTransition.old.transform || 'none'
[7m  [0m [91m                     ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/transitions/PageTransitions.astro[0m:[93m57[0m:[93m20[0m - [91merror[0m[90m ts(18048): [0m'currentTransition' is possibly 'undefined'.

[7m57[0m const oldOpacity = currentTransition.old.opacity || '1'
[7m  [0m [91m                   ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/transitions/PageTransitions.astro[0m:[93m177[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'newDocument' does not exist on type 'Event'.

[7m177[0m     const newDocument = event.newDocument
[7m   [0m [91m                              ~~~~~~~~~~~[0m
[96msrc/components/transitions/PageTransitions.astro[0m:[93m177[0m:[93m11[0m - [91merror[0m[90m ts(6133): [0m'newDocument' is declared but its value is never read.

[7m177[0m     const newDocument = event.newDocument
[7m   [0m [91m          ~~~~~~~~~~~[0m

[96msrc/components/treatment/TreatmentPlanner.tsx[0m:[93m11[0m:[93m25[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m11[0m const TreatmentPlanner: FC<TreatmentPlannerProps> = ({
[7m  [0m [91m                        ~~[0m

[96msrc/components/ui/AccessibilityAnnouncer.tsx[0m:[93m27[0m:[93m13[0m - [91merror[0m[90m ts(7030): [0mNot all code paths return a value.

[7m27[0m   useEffect(() => {
[7m  [0m [91m            ~~~~~~~[0m
[96msrc/components/ui/AccessibilityAnnouncer.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useEffect, useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/ui/Alert.astro[0m:[93m98[0m:[93m49[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m98[0m       button.addEventListener('click', (_event: Event) => {
[7m  [0m [91m                                                ~~~~~[0m
[96msrc/components/ui/Alert.astro[0m:[93m96[0m:[93m58[0m - [91merror[0m[90m ts(8010): [0mType annotations can only be used in TypeScript files.

[7m96[0m   document.addEventListener('DOMContentLoaded', (_event: Event) => {
[7m  [0m [91m                                                         ~~~~~[0m

[96msrc/components/ui/BrainVisualization.tsx[0m:[93m309[0m:[93m69[0m - [91merror[0m[90m ts(18046): [0m'b' is of type 'unknown'.

[7m309[0m                     (Object.values(moodVector).reduce((a, b) => a + b, 0) /
[7m   [0m [91m                                                                    ~[0m
[96msrc/components/ui/BrainVisualization.tsx[0m:[93m309[0m:[93m65[0m - [91merror[0m[90m ts(18046): [0m'a' is of type 'unknown'.

[7m309[0m                     (Object.values(moodVector).reduce((a, b) => a + b, 0) /
[7m   [0m [91m                                                                ~[0m
[96msrc/components/ui/BrainVisualization.tsx[0m:[93m309[0m:[93m22[0m - [91merror[0m[90m ts(2571): [0mObject is of type 'unknown'.

[7m309[0m                     (Object.values(moodVector).reduce((a, b) => a + b, 0) /
[7m   [0m [91m                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/BrainVisualization.tsx[0m:[93m29[0m:[93m34[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m29[0m export const BrainVisualization: FC<BrainVisualizationProps> = ({
[7m  [0m [91m                                 ~~[0m
[96msrc/components/ui/BrainVisualization.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useEffect, useRef, useMemo, useCallback } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/ui/EnhancedMentalHealthChat.tsx[0m:[93m121[0m:[93m40[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m121[0m export const EnhancedMentalHealthChat: FC<EnhancedMentalHealthChatProps> = ({
[7m   [0m [91m                                       ~~[0m
[96msrc/components/ui/EnhancedMentalHealthChat.tsx[0m:[93m297[0m:[93m17[0m - [93mwarning[0m[90m ts(6385): [0m'onKeyPress' is deprecated.

[7m297[0m                 onKeyPress={handleKeyPress}
[7m   [0m [93m                ~~~~~~~~~~[0m

[96msrc/components/ui/KonamiTrigger.tsx[0m:[93m4[0m:[93m29[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m4[0m export const KonamiTrigger: FC = () => {
[7m [0m [91m                            ~~[0m
[96msrc/components/ui/KonamiTrigger.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react';
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/ui/LazyChart.tsx[0m:[93m160[0m:[93m8[0m - [91merror[0m[90m ts(2741): [0mProperty 'dataKey' is missing in type '{}' but required in type 'AreaProps'.

[7m160[0m       <LazyArea {...props} />
[7m   [0m [91m       ~~~~~~~~[0m
[96msrc/components/ui/LazyChart.tsx[0m:[93m52[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'ReactNode' is not assignable to type 'ReactElement<unknown, string | JSXElementConstructor<any>>'.
  Type 'undefined' is not assignable to type 'ReactElement<unknown, string | JSXElementConstructor<any>>'.

[7m52[0m         {children}
[7m  [0m [91m        ~~~~~~~~~~[0m
[96msrc/components/ui/LazyChart.tsx[0m:[93m50[0m:[93m39[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'number | undefined'.

[7m50[0m     <Suspense fallback={<ChartLoading height={props['height']} />}>
[7m  [0m [91m                                      ~~~~~~[0m

[96msrc/components/ui/MindMirrorDashboard.tsx[0m:[93m99[0m:[93m35[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m99[0m export const MindMirrorDashboard: FC<MindMirrorDashboardProps> = ({
[7m  [0m [91m                                  ~~[0m
[96msrc/components/ui/MindMirrorDashboard.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useMemo } from 'react'
[7m [0m [91m       ~~~~~[0m
[96msrc/components/ui/MindMirrorDashboard.tsx[0m:[93m302[0m:[93m49[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'rec' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m302[0m                 {analysis.recommendations?.map((rec) => (
[7m   [0m [93m                                                ~~~[0m
[96msrc/components/ui/MindMirrorDashboard.tsx[0m:[93m279[0m:[93m42[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'insight' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m279[0m                 {analysis.insights?.map((insight) => (
[7m   [0m [93m                                         ~~~~~~~[0m

[96msrc/components/ui/OfflineIndicator.tsx[0m:[93m22[0m:[93m22[0m - [91merror[0m[90m ts(2339): [0mProperty 'connectionInfo' does not exist on type 'void'.

[7m22[0m   const { isOffline, connectionInfo } = useOffline({
[7m  [0m [91m                     ~~~~~~~~~~~~~~[0m
[96msrc/components/ui/OfflineIndicator.tsx[0m:[93m22[0m:[93m11[0m - [91merror[0m[90m ts(2339): [0mProperty 'isOffline' does not exist on type 'void'.

[7m22[0m   const { isOffline, connectionInfo } = useOffline({
[7m  [0m [91m          ~~~~~~~~~[0m
[96msrc/components/ui/OfflineIndicator.tsx[0m:[93m17[0m:[93m32[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m17[0m export const OfflineIndicator: FC<OfflineIndicatorProps> = ({
[7m  [0m [91m                               ~~[0m
[96msrc/components/ui/OfflineIndicator.tsx[0m:[93m1[0m:[93m1[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React from 'react'
[7m [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/ui/ServiceWorkerUpdater.tsx[0m:[93m17[0m:[93m36[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m17[0m export const ServiceWorkerUpdater: FC<ServiceWorkerUpdaterProps> = ({
[7m  [0m [91m                                   ~~[0m
[96msrc/components/ui/ServiceWorkerUpdater.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useEffect, useState } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/ui/ToastProvider.tsx[0m:[93m23[0m:[93m9[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'success' does not exist in type 'Partial<Partial<Pick<Toast, "style" | "duration" | "className" | "id" | "icon" | "ariaProps" | "position" | "iconTheme" | "toasterId" | "removeDelay">>>'.

[7m23[0m         success: {
[7m  [0m [91m        ~~~~~~~[0m

[96msrc/components/ui/UserMenu.tsx[0m:[93m58[0m:[93m21[0m - [91merror[0m[90m ts(2339): [0mProperty 'user_metadata' does not exist on type 'AuthUser'.

[7m58[0m               {user.user_metadata?.full_name || user.email}
[7m  [0m [91m                    ~~~~~~~~~~~~~[0m
[96msrc/components/ui/UserMenu.tsx[0m:[93m47[0m:[93m21[0m - [91merror[0m[90m ts(2339): [0mProperty 'user_metadata' does not exist on type 'AuthUser'.

[7m47[0m           src={user.user_metadata?.avatar_url}
[7m  [0m [91m                    ~~~~~~~~~~~~~[0m
[96msrc/components/ui/UserMenu.tsx[0m:[93m3[0m:[93m24[0m - [91merror[0m[90m ts(2307): [0mCannot find module './avatar' or its corresponding type declarations.

[7m3[0m import { Avatar } from './avatar'
[7m [0m [91m                       ~~~~~~~~~~[0m
[96msrc/components/ui/UserMenu.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, { useState, useRef, useEffect } from 'react'
[7m [0m [91m       ~~~~~[0m

[96msrc/components/ui/checkbox.tsx[0m:[93m15[0m:[93m24[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m15[0m export const Checkbox: FC<CheckboxProps> = ({
[7m  [0m [91m                       ~~[0m

[96msrc/components/ui/dialog.tsx[0m:[93m298[0m:[93m31[0m - [91merror[0m[90m ts(2352): [0mConversion of type 'KeyboardEvent<HTMLDivElement>' to type 'MouseEvent<HTMLDivElement, MouseEvent>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Type 'KeyboardEvent<HTMLDivElement>' is missing the following properties from type 'MouseEvent<HTMLDivElement, MouseEvent>': button, buttons, clientX, clientY, and 7 more.

[7m298[0m           handleBackdropClick(e as React.MouseEvent<HTMLDivElement>)
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/ui/popover.tsx[0m:[93m94[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m94[0m export const PopoverContent: FC<PopoverContentProps> = ({
[7m  [0m [91m                             ~~[0m
[96msrc/components/ui/popover.tsx[0m:[93m75[0m:[93m30[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m75[0m export const PopoverTrigger: FC<PopoverTriggerProps> = ({
[7m  [0m [91m                             ~~[0m
[96msrc/components/ui/popover.tsx[0m:[93m29[0m:[93m23[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m29[0m export const Popover: FC<PopoverProps> = ({
[7m  [0m [91m                      ~~[0m

[96msrc/components/ui/rubiks-cube.tsx[0m:[93m6[0m:[93m10[0m - [91merror[0m[90m ts(2305): [0mModule '"@react-three/drei"' has no exported member 'PerspectiveCamera'.

[7m6[0m import { PerspectiveCamera } from "@react-three/drei";
[7m [0m [91m         ~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/rubiks-cube.tsx[0m:[93m5[0m:[93m10[0m - [91merror[0m[90m ts(2305): [0mModule '"@react-three/drei"' has no exported member 'SpotLight'.

[7m5[0m import { SpotLight } from "@react-three/drei";
[7m [0m [91m         ~~~~~~~~~[0m
[96msrc/components/ui/rubiks-cube.tsx[0m:[93m4[0m:[93m10[0m - [91merror[0m[90m ts(2305): [0mModule '"@react-three/drei"' has no exported member 'RoundedBox'.

[7m4[0m import { RoundedBox } from "@react-three/drei";
[7m [0m [91m         ~~~~~~~~~~[0m

[96msrc/components/ui/scroll-area.tsx[0m:[93m10[0m:[93m26[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m10[0m export const ScrollArea: FC<ScrollAreaProps> = ({
[7m  [0m [91m                         ~~[0m

[96msrc/components/ui/skeleton.tsx[0m:[93m103[0m:[93m7[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'Element' is not assignable to parameter of type 'never'.

[7m103[0m       <Skeleton
[7m   [0m [91m      ~~~~~~~~~[0m
[7m104[0m         key={`text-line-${i}`}
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m111[0m         {...props}
[7m   [0m [91m~~~~~~~~~~~~~~~~~~[0m
[7m112[0m       />,
[7m   [0m [91m~~~~~~~~[0m
[96msrc/components/ui/skeleton.tsx[0m:[93m71[0m:[93m18[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'Element' is not assignable to parameter of type 'never'.

[7m71[0m       items.push(<br key={`br-${i}`} />)
[7m  [0m [91m                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/skeleton.tsx[0m:[93m61[0m:[93m7[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'Element' is not assignable to parameter of type 'never'.

[7m 61[0m       <span
[7m   [0m [91m      ~~~~~[0m
[7m 62[0m         key={`skeleton-${i}`}
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m 65[0m         {...props}
[7m   [0m [91m~~~~~~~~~~~~~~~~~~[0m
[7m 66[0m       />,
[7m   [0m [91m~~~~~~~~[0m

[96msrc/components/ui/slider.tsx[0m:[93m15[0m:[93m15[0m - [91merror[0m[90m ts(2304): [0mCannot find name 'FC'.

[7m15[0m const Slider: FC<SliderProps> = ({
[7m  [0m [91m              ~~[0m

[96msrc/components/ui/table.tsx[0m:[93m415[0m:[93m18[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'number' is not assignable to parameter of type 'never'.

[7m415[0m       pages.push(i)
[7m   [0m [91m                 ~[0m

[96msrc/components/ui/tabs.tsx[0m:[93m1[0m:[93m8[0m - [91merror[0m[90m ts(6133): [0m'React' is declared but its value is never read.

[7m1[0m import React, {
[7m [0m [91m       ~~~~~[0m

[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m125[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m125[0m     const { container } = await renderAstro(Alert, {
[7m   [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m114[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m114[0m     const { container } = await renderAstro(Alert, {
[7m   [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m104[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m104[0m     const { container } = await renderAstro(Alert, {
[7m   [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m93[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m93[0m     const { container } = await renderAstro(Alert, {
[7m  [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m81[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m81[0m     const { container } = await renderAstro(Alert, {
[7m  [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m69[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m69[0m     const { container } = await renderAstro(Alert, {
[7m  [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m55[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m55[0m     const { container } = await renderAstro(Alert, {
[7m  [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m38[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m38[0m     const { container } = await renderAstro(Alert, {
[7m  [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m19[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m19[0m     const { container } = await renderAstro(Alert, {
[7m  [0m [91m                                            ~~~~~[0m
[96msrc/components/ui/__tests__/Alert.test.ts[0m:[93m7[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type '(_props: Props) => any' is not assignable to parameter of type 'AstroComponent'.

[7m7[0m     const { container } = await renderAstro(Alert, {
[7m [0m [91m                                            ~~~~~[0m

[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m158[0m:[93m9[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m158[0m         Card as unknown,
[7m   [0m [91m        ~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m150[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m150[0m       await renderAstro(CardAction as unknown, {}, 'Card Action')
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m137[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m137[0m       const { astroContainer } = await renderAstro(CardAction as unknown)
[7m   [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m130[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m130[0m       await renderAstro(CardFooter as unknown, {}, 'Card Footer')
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m118[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m118[0m       const { astroContainer } = await renderAstro(CardFooter as unknown)
[7m   [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m111[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m111[0m       await renderAstro(CardContent as unknown, {}, 'Card Content')
[7m   [0m [91m                        ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m104[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m104[0m       const { astroContainer } = await renderAstro(CardContent as unknown)
[7m   [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m97[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m97[0m       await renderAstro(CardDescription as unknown, {}, 'Card Description')
[7m  [0m [91m                        ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m88[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m88[0m       const { astroContainer } = await renderAstro(CardDescription as unknown)
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m81[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m81[0m       await renderAstro(CardTitle as unknown, {}, 'Card Title')
[7m  [0m [91m                        ~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m74[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m74[0m       const { astroContainer } = await renderAstro(CardTitle as unknown)
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m61[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m61[0m       const { astroContainer } = await renderAstro(CardHeader as unknown, {
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m46[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m46[0m       const { astroContainer } = await renderAstro(CardHeader as unknown)
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m39[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m39[0m       await renderAstro(Card as unknown, {}, 'Card Content')
[7m  [0m [91m                        ~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m32[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m32[0m       const { astroContainer } = await renderAstro(Card as unknown, { class: customClass })
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/Card.test.ts[0m:[93m14[0m:[93m52[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m14[0m       const { astroContainer } = await renderAstro(Card as unknown)
[7m  [0m [91m                                                   ~~~~~~~~~~~~~~~[0m

[96msrc/components/ui/__tests__/ThemeToggle.test.ts[0m:[93m132[0m:[93m50[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m132[0m     const { astroContainer } = await renderAstro(ThemeToggle as unknown)
[7m   [0m [91m                                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/ThemeToggle.test.ts[0m:[93m113[0m:[93m50[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m113[0m     const { astroContainer } = await renderAstro(ThemeToggle as unknown)
[7m   [0m [91m                                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/ThemeToggle.test.ts[0m:[93m103[0m:[93m50[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m103[0m     const { astroContainer } = await renderAstro(ThemeToggle as unknown, { class: customClass })
[7m   [0m [91m                                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/ThemeToggle.test.ts[0m:[93m77[0m:[93m50[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m77[0m     const { astroContainer } = await renderAstro(ThemeToggle as unknown)
[7m  [0m [91m                                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/ThemeToggle.test.ts[0m:[93m47[0m:[93m50[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m47[0m     const { astroContainer } = await renderAstro(ThemeToggle as unknown)
[7m  [0m [91m                                                 ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/__tests__/ThemeToggle.test.ts[0m:[93m39[0m:[93m50[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m39[0m     const { astroContainer } = await renderAstro(ThemeToggle as unknown)
[7m  [0m [91m                                                 ~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/ui/button/button-types.ts[0m:[93m73[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ 'aria-label': string | undefined; 'aria-description': string | undefined; 'aria-disabled': boolean | undefined; 'aria-busy': boolean | undefined; }' is not assignable to type 'void'.

[7m73[0m   return {
[7m  [0m [91m  ~~~~~~[0m

[96msrc/components/ui/button/button.tsx[0m:[93m72[0m:[93m7[0m - [91merror[0m[90m ts(2698): [0mSpread types may only be created from object types.

[7m72[0m       ...getAriaProps({ loading, disabled, ...props }),
[7m  [0m [91m      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/ui/form/MobileFormValidation.tsx[0m:[93m319[0m:[93m17[0m - [91merror[0m[90m ts(2352): [0mConversion of type '(e: Event) => void' to type 'FocusEventHandler<Element>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Types of parameters 'e' and 'event' are incompatible.

[7m319[0m         onBlur: handleBlur as React.FocusEventHandler,
[7m   [0m [91m                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/components/ui/form/MobileFormValidation.tsx[0m:[93m318[0m:[93m19[0m - [91merror[0m[90m ts(2352): [0mConversion of type '(e: Event) => void' to type 'ChangeEventHandler<Element>' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Types of parameters 'e' and 'event' are incompatible.

[7m318[0m         onChange: handleChange as React.ChangeEventHandler,
[7m   [0m [91m                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/components/views/GithubView.astro[0m:[93m106[0m:[93m11[0m - [91merror[0m[90m ts(2322): [0mType 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

[7m106[0m           versionNum,
[7m   [0m [91m          ~~~~~~~~~~[0m

[96msrc/components/views/RenderPage.astro[0m:[93m18[0m:[93m5[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'tocComponent' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m18[0m let tocComponent
[7m  [0m [93m    ~~~~~~~~~~~~[0m
[96msrc/components/views/RenderPage.astro[0m:[93m17[0m:[93m5[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'contentResult' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m17[0m let contentResult
[7m  [0m [93m    ~~~~~~~~~~~~~[0m

[96msrc/components/views/RenderPost.astro[0m:[93m14[0m:[93m5[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'tocComponent' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m14[0m let tocComponent
[7m  [0m [93m    ~~~~~~~~~~~~[0m
[96msrc/components/views/RenderPost.astro[0m:[93m13[0m:[93m5[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'contentResult' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m13[0m let contentResult
[7m  [0m [93m    ~~~~~~~~~~~~~[0m

[96msrc/components/widgets/ShareLink.astro[0m:[93m289[0m:[93m54[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type '[boolean, (string | undefined)?] | undefined'.

[7m289[0m           href={linkConfig.formatUrl(initialPostUrl, provider.cfg)}
[7m   [0m [91m                                                     ~~~~~~~~~~~~[0m
[96msrc/components/widgets/ShareLink.astro[0m:[93m121[0m:[93m15[0m - [91merror[0m[90m ts(6196): [0m'_ShareLink' is declared but never used.

[7m121[0m     interface _ShareLink {
[7m   [0m [91m              ~~~~~~~~~~[0m

[96msrc/components/widgets/SwiperCarousel.astro[0m:[93m3[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro:assets"' has no exported member 'ImageMetadata'.

[7m3[0m import type { ImageMetadata } from 'astro:assets'
[7m [0m [91m              ~~~~~~~~~~~~~[0m

[96msrc/data/sample-cognitive-models.ts[0m:[93m1136[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m1136[0m         'Basic emotional regulation'
[7m    [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m1135[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m1135[0m         'Safety planning',
[7m    [0m [91m        ~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m1134[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m1134[0m         'Grounding techniques',
[7m    [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m1087[0m:[93m7[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'resistance' does not exist in type 'ConversationalStyle'.

[7m1087[0m       resistance: 6,
[7m    [0m [91m      ~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m749[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m749[0m         'Basic cognitive restructuring'
[7m   [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m748[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m748[0m         'Progressive muscle relaxation',
[7m   [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m747[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m747[0m         'Deep breathing',
[7m   [0m [91m        ~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m704[0m:[93m7[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'resistance' does not exist in type 'ConversationalStyle'.

[7m704[0m       resistance: 7,
[7m   [0m [91m      ~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m361[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m361[0m         'Mindfulness techniques'
[7m   [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m360[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m360[0m         'Activity scheduling',
[7m   [0m [91m        ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m359[0m:[93m9[0m - [91merror[0m[90m ts(2322): [0mType 'string' is not assignable to type 'SkillAcquired'.

[7m359[0m         'Basic thought challenging',
[7m   [0m [91m        ~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/data/sample-cognitive-models.ts[0m:[93m318[0m:[93m7[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'resistance' does not exist in type 'ConversationalStyle'.

[7m318[0m       resistance: 6,
[7m   [0m [91m      ~~~~~~~~~~[0m

[96msrc/e2e/breach-notification.spec.ts[0m:[93m307[0m:[93m34[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{}' is not assignable to parameter of type 'string'.

[7m307[0m             postData: JSON.parse((await request.postData() as unknown) || '{}'),
[7m   [0m [91m                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m199[0m:[93m34[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{}' is not assignable to parameter of type 'string'.

[7m199[0m             postData: JSON.parse((await request.postData() as unknown) || '{}'),
[7m   [0m [91m                                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m108[0m:[93m36[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{}' is not assignable to parameter of type 'string'.

[7m108[0m               postData: JSON.parse(request.postData() as unknown || '{}'),
[7m   [0m [91m                                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m64[0m:[93m30[0m - [91merror[0m[90m ts(2339): [0mProperty 'getInstance' does not exist on type 'MongoAuthService'.

[7m64[0m     const auth = AuthService.getInstance()
[7m  [0m [91m                             ~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m55[0m:[93m32[0m - [91merror[0m[90m ts(2749): [0m'AuthService' refers to a value, but is being used as a type here. Did you mean 'typeof AuthService'?

[7m55[0m   auth: async (_: {}, use: (a: AuthService) => Promise<void>) => {
[7m  [0m [91m                               ~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m10[0m:[93m9[0m - [91merror[0m[90m ts(2749): [0m'AuthService' refers to a value, but is being used as a type here. Did you mean 'typeof AuthService'?

[7m10[0m   auth: AuthService
[7m  [0m [91m        ~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m307[0m:[93m35[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m307[0m             postData: JSON.parse((await request.postData() as unknown) || '{}'),
[7m   [0m [93m                                  ~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/e2e/breach-notification.spec.ts[0m:[93m199[0m:[93m35[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m199[0m             postData: JSON.parse((await request.postData() as unknown) || '{}'),
[7m   [0m [93m                                  ~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/hooks/useAuth.ts[0m:[93m294[0m:[93m46[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{}' is not assignable to parameter of type 'string'.

[7m294[0m       const result = await authUpdateProfile(user.id, profile)
[7m   [0m [91m                                             ~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m265[0m:[93m26[0m - [91merror[0m[90m ts(2339): [0mProperty 'user' does not exist on type '{ success: boolean; error: unknown; }'.

[7m265[0m         setUser(response.user)
[7m   [0m [91m                         ~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m264[0m:[93m20[0m - [91merror[0m[90m ts(2339): [0mProperty 'user' does not exist on type '{ success: boolean; error: unknown; }'.

[7m264[0m       if (response.user) {
[7m   [0m [91m                   ~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m259[0m:[93m11[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{}' is not assignable to parameter of type 'string'.

[7m259[0m           response.error || 'OTP verification failed',
[7m   [0m [91m          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m236[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'void' is not assignable to type 'boolean'.

[7m236[0m       return await authResetPassword(email, redirectTo)
[7m   [0m [91m      ~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m213[0m:[93m13[0m - [91merror[0m[90m ts(2554): [0mExpected 1 arguments, but got 0.

[7m213[0m       await authSignOut()
[7m   [0m [91m            ~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m163[0m:[93m18[0m - [91merror[0m[90m ts(2339): [0mProperty 'error' does not exist on type '{ user: AuthUser | null; session: { access_token: any; refresh_token: any; }; }'.

[7m163[0m           result.error || 'Registration failed',
[7m   [0m [91m                 ~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m74[0m:[93m35[0m - [91merror[0m[90m ts(2554): [0mExpected 1 arguments, but got 0.

[7m74[0m         const currentUser = await getCurrentUser()
[7m  [0m [91m                                  ~~~~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m236[0m:[93m14[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m236[0m       return await authResetPassword(email, redirectTo)
[7m   [0m [93m             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m213[0m:[93m7[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m213[0m       await authSignOut()
[7m   [0m [93m      ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m193[0m:[93m7[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m193[0m       await authSignInWithOAuth(provider, redirectTo)
[7m   [0m [93m      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m123[0m:[93m22[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m123[0m       const result = await signInWithEmail(email, password)
[7m   [0m [93m                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useAuth.ts[0m:[93m74[0m:[93m29[0m - [93mwarning[0m[90m ts(80007): [0m'await' has no effect on the type of this expression.

[7m74[0m         const currentUser = await getCurrentUser()
[7m  [0m [93m                            ~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/hooks/useChatWithMemory.ts[0m:[93m45[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ sendMessage: (message: string) => Promise<any>; isLoading: boolean; memory: UseMemoryReturn; messages: LocalMessage[]; input: string; handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void; handleSubmit: (e: React.FormEvent) => Promise<void>; setMessages: React.Dispatch<React.SetStateAction<LocalMessage[]>>...' is not assignable to type 'void'.

[7m45[0m   return {
[7m  [0m [91m  ~~~~~~[0m
[96msrc/hooks/useChatWithMemory.ts[0m:[93m32[0m:[93m32[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ content: any; type: string; metadata: { timestamp: string; }; }' is not assignable to parameter of type 'string'.

[7m 32[0m         await memory.addMemory({
[7m   [0m [91m                               ~[0m
[7m 33[0m           content: response,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m 35[0m           metadata: { timestamp: new Date().toISOString() }
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m 36[0m         })
[7m   [0m [91m~~~~~~~~~[0m
[96msrc/hooks/useChatWithMemory.ts[0m:[93m28[0m:[93m35[0m - [91merror[0m[90m ts(2551): [0mProperty 'sendMessage' does not exist on type 'UseChatReturn'. Did you mean 'setMessages'?

[7m28[0m       const response = await chat.sendMessage(message)
[7m  [0m [91m                                  ~~~~~~~~~~~[0m
[96msrc/hooks/useChatWithMemory.ts[0m:[93m21[0m:[93m30[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ content: string; type: string; metadata: { timestamp: string; }; }' is not assignable to parameter of type 'string'.

[7m 21[0m       await memory.addMemory({
[7m   [0m [91m                             ~[0m
[7m 22[0m         content: message,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m...[0m
[7m 24[0m         metadata: { timestamp: new Date().toISOString() }
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m 25[0m       })
[7m   [0m [91m~~~~~~~[0m
[96msrc/hooks/useChatWithMemory.ts[0m:[93m14[0m:[93m26[0m - [91merror[0m[90m ts(2322): [0mType '{ role: "user" | "assistant"; content: string; }[]' is not assignable to type 'Message[]'.
  Property 'name' is missing in type '{ role: "user" | "assistant"; content: string; }' but required in type 'Message'.

[7m14[0m   const chat = useChat({ initialMessages })
[7m  [0m [91m                         ~~~~~~~~~~~~~~~[0m

[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m122[0m:[93m46[0m - [91merror[0m[90m ts(2454): [0mVariable 'generateSummary' is used before being assigned.

[7m122[0m     [minConfidence, onDetection, onComplete, generateSummary],
[7m   [0m [91m                                             ~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m122[0m:[93m46[0m - [91merror[0m[90m ts(2448): [0mBlock-scoped variable 'generateSummary' used before its declaration.

[7m122[0m     [minConfidence, onDetection, onComplete, generateSummary],
[7m   [0m [91m                                             ~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m86[0m:[93m21[0m - [91merror[0m[90m ts(18046): [0m'config' is of type 'unknown'.

[7m86[0m               type: config.type,
[7m  [0m [91m                    ~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m68[0m:[93m46[0m - [91merror[0m[90m ts(18046): [0m'config' is of type 'unknown'.

[7m68[0m             0.5 + (matchingPatterns.length / config.patterns.length) * 0.5,
[7m  [0m [91m                                             ~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m61[0m:[93m34[0m - [91merror[0m[90m ts(18046): [0m'config' is of type 'unknown'.

[7m61[0m         const matchingPatterns = config.patterns.filter((pattern) =>
[7m  [0m [91m                                 ~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m7[0m:[93m44[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../lib/ai/types/CognitiveDistortions' or its corresponding type declarations.

[7m7[0m import { cognitiveDistortionConfigs } from '../lib/ai/types/CognitiveDistortions'
[7m [0m [91m                                           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m6[0m:[93m8[0m - [91merror[0m[90m ts(2307): [0mCannot find module '../lib/ai/types/CognitiveDistortions' or its corresponding type declarations.

[7m6[0m } from '../lib/ai/types/CognitiveDistortions'
[7m [0m [91m       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useCognitiveDistortionDetection.ts[0m:[93m61[0m:[93m58[0m - [93mwarning[0m[90m ts(7044): [0mParameter 'pattern' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m61[0m         const matchingPatterns = config.patterns.filter((pattern) =>
[7m  [0m [93m                                                         ~~~~~~~[0m

[96msrc/hooks/useComparativeProgress.ts[0m:[93m41[0m:[93m17[0m - [93mwarning[0m[90m ts(80004): [0mJSDoc types may be moved to TypeScript types.

[7m41[0m export function useComparativeProgress(
[7m  [0m [93m                ~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/hooks/useConversionTracking.ts[0m:[93m49[0m:[93m29[0m - [91merror[0m[90m ts(2554): [0mExpected 1 arguments, but got 2.

[7m49[0m     trackEvent('page_view', { path })
[7m  [0m [91m                            ~~~~~~~~[0m

[96msrc/hooks/useEmotionDetection.ts[0m:[93m68[0m:[93m23[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m68[0m           confidence: analysis.confidence || 0.8,
[7m  [0m [91m                      ~~~~~~~~[0m
[96msrc/hooks/useEmotionDetection.ts[0m:[93m67[0m:[93m22[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m67[0m           intensity: analysis.intensity || 0.5,
[7m  [0m [91m                     ~~~~~~~~[0m
[96msrc/hooks/useEmotionDetection.ts[0m:[93m66[0m:[93m30[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m66[0m           secondaryEmotions: analysis.secondaryEmotions || [],
[7m  [0m [91m                             ~~~~~~~~[0m
[96msrc/hooks/useEmotionDetection.ts[0m:[93m65[0m:[93m27[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m65[0m           primaryEmotion: analysis.primaryEmotion || 'neutral',
[7m  [0m [91m                          ~~~~~~~~[0m

[96msrc/hooks/useEmotionProgress.ts[0m:[93m206[0m:[93m17[0m - [91merror[0m[90m ts(2345): [0mArgument of type '{ date: string; overallImprovement: number; stabilityChange: number; positiveEmotionChange: number; negativeEmotionChange: number; }' is not assignable to parameter of type 'never'.

[7m206[0m     result.push({
[7m   [0m [91m                ~[0m
[7m207[0m       date,
[7m   [0m [91m~~~~~~~~~~~[0m
[7m...[0m
[7m211[0m       negativeEmotionChange: negative,
[7m   [0m [91m~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[7m212[0m     })
[7m   [0m [91m~~~~~[0m
[96msrc/hooks/useEmotionProgress.ts[0m:[93m2[0m:[93m42[0m - [91merror[0m[90m ts(2307): [0mCannot find module '@/lib/ai/temporal/types' or its corresponding type declarations.

[7m2[0m import type { ProgressionAnalysis } from '@/lib/ai/temporal/types'
[7m [0m [91m                                         ~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/hooks/useMemory.ts[0m:[93m381[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ setPreference: (key: string, value: unknown) => Promise<void>; getPreference: (key: string) => string | number | boolean | object | null; removePreference: (key: string) => Promise<...>; ... 15 more ...; getMemoryHistory: () => Promise<MemoryHistoryItem[]>; }' is not assignable to type 'void'.

[7m381[0m   return {
[7m   [0m [91m  ~~~~~~[0m
[96msrc/hooks/useMemory.ts[0m:[93m357[0m:[93m38[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'string | number | boolean | object | null'.

[7m357[0m           return match && match[1] ? JSON.parse(match[1]) as unknown : null
[7m   [0m [91m                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/useMemory.ts[0m:[93m315[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ addMessage: (message: string, role?: "user" | "assistant") => Promise<void>; getConversationHistory: () => Promise<MemoryEntry[]>; memories: MemoryEntry[]; ... 14 more ...; getMemoryHistory: () => Promise<MemoryHistoryItem[]>; }' is not assignable to type 'void'.

[7m315[0m   return {
[7m   [0m [91m  ~~~~~~[0m
[96msrc/hooks/useMemory.ts[0m:[93m272[0m:[93m5[0m - [91merror[0m[90m ts(2322): [0mType '(preference: string, value: string | number | boolean | object) => Promise<void>' is not assignable to type '(preference: string, value: unknown) => Promise<void>'.
  Types of parameters 'value' and 'value' are incompatible.

[7m272[0m     addUserPreference,
[7m   [0m [91m    ~~~~~~~~~~~~~~~~~[0m

[96msrc/hooks/useOffline.ts[0m:[93m114[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ isOffline: boolean; checkConnection: () => Promise<boolean>; connectionInfo: ConnectionInfo; }' is not assignable to type 'void'.

[7m114[0m   return {
[7m   [0m [91m  ~~~~~~[0m

[96msrc/hooks/usePasswordStrength.ts[0m:[93m150[0m:[93m26[0m - [91merror[0m[90m ts(2345): [0mArgument of type '"special characters"' is not assignable to parameter of type 'never'.

[7m150[0m         suggestions.push('special characters')
[7m   [0m [91m                         ~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/usePasswordStrength.ts[0m:[93m147[0m:[93m26[0m - [91merror[0m[90m ts(2345): [0mArgument of type '"numbers"' is not assignable to parameter of type 'never'.

[7m147[0m         suggestions.push('numbers')
[7m   [0m [91m                         ~~~~~~~~~[0m
[96msrc/hooks/usePasswordStrength.ts[0m:[93m144[0m:[93m26[0m - [91merror[0m[90m ts(2345): [0mArgument of type '"lowercase letters"' is not assignable to parameter of type 'never'.

[7m144[0m         suggestions.push('lowercase letters')
[7m   [0m [91m                         ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/usePasswordStrength.ts[0m:[93m141[0m:[93m26[0m - [91merror[0m[90m ts(2345): [0mArgument of type '"uppercase letters"' is not assignable to parameter of type 'never'.

[7m141[0m         suggestions.push('uppercase letters')
[7m   [0m [91m                         ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/usePasswordStrength.ts[0m:[93m138[0m:[93m26[0m - [91merror[0m[90m ts(2345): [0mArgument of type '"longer password"' is not assignable to parameter of type 'never'.

[7m138[0m         suggestions.push('longer password')
[7m   [0m [91m                         ~~~~~~~~~~~~~~~~~[0m

[96msrc/hooks/usePatientModel.ts[0m:[93m136[0m:[93m39[0m - [91merror[0m[90m ts(2339): [0mProperty 'generatePatientPrompt' does not exist on type 'PatientModelService'.

[7m136[0m         const prompt = patientService.generatePatientPrompt(responseContext)
[7m   [0m [91m                                      ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/usePatientModel.ts[0m:[93m123[0m:[93m54[0m - [91merror[0m[90m ts(2339): [0mProperty 'createResponseContext' does not exist on type 'PatientModelService'.

[7m123[0m         const responseContext = await patientService.createResponseContext(
[7m   [0m [91m                                                     ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/hooks/usePatientModel.ts[0m:[93m69[0m:[93m44[0m - [91merror[0m[90m ts(2551): [0mProperty 'getModelById' does not exist on type 'PatientModelService'. Did you mean 'getModel'?

[7m69[0m         const model = await patientService.getModelById(currentModelId)
[7m  [0m [91m                                           ~~~~~~~~~~~~[0m
[96msrc/hooks/usePatientModel.ts[0m:[93m45[0m:[93m29[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m45[0m           setCurrentModelId(models[0].id)
[7m  [0m [91m                            ~~~~~~~~~[0m
[96msrc/hooks/usePatientModel.ts[0m:[93m41[0m:[93m28[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'CognitiveModel[]' is not assignable to parameter of type 'SetStateAction<string[]>'.
  Type 'CognitiveModel[]' is not assignable to type 'string[]'.

[7m41[0m         setAvailableModels(models)
[7m  [0m [91m                           ~~~~~~[0m

[96msrc/hooks/useRiskAssessment.ts[0m:[93m53[0m:[93m23[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m53[0m           confidence: analysis.confidence || 0.5,
[7m  [0m [91m                      ~~~~~~~~[0m
[96msrc/hooks/useRiskAssessment.ts[0m:[93m52[0m:[93m27[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m52[0m           requiresExpert: analysis.requiresExpert || false,
[7m  [0m [91m                          ~~~~~~~~[0m
[96msrc/hooks/useRiskAssessment.ts[0m:[93m51[0m:[93m20[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m51[0m           factors: analysis.factors || [],
[7m  [0m [91m                   ~~~~~~~~[0m
[96msrc/hooks/useRiskAssessment.ts[0m:[93m50[0m:[93m21[0m - [91merror[0m[90m ts(18046): [0m'analysis' is of type 'unknown'.

[7m50[0m           category: analysis.category || 'low',
[7m  [0m [91m                    ~~~~~~~~[0m
[96msrc/hooks/useRiskAssessment.ts[0m:[93m34[0m:[93m13[0m - [91merror[0m[90m ts(2358): [0mThe left-hand side of an 'instanceof' expression must be of type 'any', an object type or a type parameter.

[7m34[0m         if (response instanceof ReadableStream) {
[7m  [0m [91m            ~~~~~~~~[0m

[96msrc/hooks/useSecurity.ts[0m:[93m23[0m:[93m28[0m - [91merror[0m[90m ts(2554): [0mExpected 1 arguments, but got 0.

[7m23[0m           await fheService.initialize()
[7m  [0m [91m                           ~~~~~~~~~~[0m

[96msrc/hooks/useTemporalEmotionAnalysis.ts[0m:[93m125[0m:[93m29[0m - [91merror[0m[90m ts(2339): [0mProperty 'progression' does not exist on type 'TemporalEmotionAnalysis'.

[7m125[0m     TemporalEmotionAnalysis['progression'] | null
[7m   [0m [91m                            ~~~~~~~~~~~~~[0m
[96msrc/hooks/useTemporalEmotionAnalysis.ts[0m:[93m119[0m:[93m40[0m - [91merror[0m[90m ts(2339): [0mProperty 'progression' does not exist on type 'TemporalEmotionAnalysis'.

[7m119[0m   progression: TemporalEmotionAnalysis['progression'] | null
[7m   [0m [91m                                       ~~~~~~~~~~~~~[0m

[96msrc/hooks/useWebSocket.ts[0m:[93m81[0m:[93m17[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'WebSocketMessage'.

[7m81[0m           const message: WebSocketMessage = JSON.parse(event.data) as unknown
[7m  [0m [91m                ~~~~~~~[0m

[96msrc/hooks/__tests__/usePatternDetection.test.ts[0m:[93m26[0m:[93m7[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'timestamp' does not exist in type 'Message'.

[7m26[0m       timestamp: Date.now(),
[7m  [0m [91m      ~~~~~~~~~[0m
[96msrc/hooks/__tests__/usePatternDetection.test.ts[0m:[93m19[0m:[93m7[0m - [91merror[0m[90m ts(2353): [0mObject literal may only specify known properties, and 'timestamp' does not exist in type 'Message'.

[7m19[0m       timestamp: Date.now() - 1000,
[7m  [0m [91m      ~~~~~~~~~[0m

[96msrc/hooks/__tests__/vitest.setup.ts[0m:[93m3[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType 'typeof TextEncoder' is not assignable to type '{ new (): TextEncoder; prototype: TextEncoder; }'.
  The types returned by 'prototype.encode(...)' are incompatible between these types.

[7m3[0m   globalThis.TextEncoder = TextEncoder
[7m [0m [91m  ~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/integrations/search.ts[0m:[93m1[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'AstroIntegration'.

[7m1[0m import type { AstroIntegration } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~~~~~[0m

[96msrc/layouts/AuthLayout.astro[0m:[93m26[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '{ children: any; title: any; description: any; showNavBar: boolean; showFooter: boolean; bgPattern: boolean; usePlumAnimation: boolean; centered: boolean; containerClass: string; contentClass: string; transitionMode: any; }' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'showNavBar' does not exist on type 'IntrinsicAttributes & Props'.

[7m26[0m   showNavBar={true}
[7m  [0m [91m  ~~~~~~~~~~[0m

[96msrc/layouts/BlogLayout.astro[0m:[93m43[0m:[93m11[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m43[0m           type="application/ld+json"
[7m  [0m [93m          ~~~~[0m

[96msrc/layouts/BlogPostLayout.astro[0m:[93m45[0m:[93m45[0m - [91merror[0m[90m ts(2322): [0mType '{ children: any; title: any; description: any; ogImage: any; bgType: "rose"; }' is not assignable to type 'IntrinsicAttributes & Props'.
  Property 'ogImage' does not exist on type 'IntrinsicAttributes & Props'.

[7m45[0m <BaseLayout title={postTitle} {description} ogImage={image?.url} bgType="rose">
[7m  [0m [91m                                            ~~~~~~~[0m

[96msrc/layouts/ChatLayout.astro[0m:[93m2[0m:[93m34[0m - [91merror[0m[90m ts(2339): [0mProperty 'props' does not exist on type '{ url: URL; site: URL; }'.

[7m2[0m const { title = 'Chat' } = Astro.props
[7m [0m [91m                                 ~~~~~[0m

[96msrc/layouts/Layout.astro[0m:[93m44[0m:[93m13[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m44[0m     <script src="/js/background-loader.js" defer></script>
[7m  [0m [93m            ~~~[0m
[96msrc/layouts/Layout.astro[0m:[93m41[0m:[93m13[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m41[0m     <script src="/js/module-loader.js" defer></script>
[7m  [0m [93m            ~~~[0m

[96msrc/layouts/TailusLayout.astro[0m:[93m23[0m:[93m7[0m - [93mwarning[0m[90m astro(4000): [0mThis script will be treated as if it has the `is:inline` directive because it contains an attribute. Therefore, features that require processing (e.g. using TypeScript or npm packages in the script) are unavailable.

See docs for more details: https://docs.astro.build/en/guides/client-side-scripts/#script-processing.

Add the `is:inline` directive explicitly to silence this hint.

[7m23[0m       data-goatcounter="https://pixelated.goatcounter.com/count"
[7m  [0m [93m      ~~~~~~~~~~~~~~~~[0m

[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m111[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m111[0m     const { container } = await renderAstro(DashboardLayout as unknown)
[7m   [0m [91m                                            ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m110[0m:[93m56[0m - [91merror[0m[90m ts(7036): [0mDynamic import's specifier must be of type 'string', but here has type 'unknown'.

[7m110[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m   [0m [91m                                                       ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m110[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'default' does not exist on type 'unknown'.

[7m110[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m   [0m [91m            ~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m89[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m89[0m     const { container } = await renderAstro(DashboardLayout as unknown, {
[7m  [0m [91m                                            ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m88[0m:[93m56[0m - [91merror[0m[90m ts(7036): [0mDynamic import's specifier must be of type 'string', but here has type 'unknown'.

[7m88[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m  [0m [91m                                                       ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m88[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'default' does not exist on type 'unknown'.

[7m88[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m  [0m [91m            ~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m71[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m71[0m     const { container } = await renderAstro(DashboardLayout as unknown, customProps)
[7m  [0m [91m                                            ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m70[0m:[93m56[0m - [91merror[0m[90m ts(7036): [0mDynamic import's specifier must be of type 'string', but here has type 'unknown'.

[7m70[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m  [0m [91m                                                       ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m70[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'default' does not exist on type 'unknown'.

[7m70[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m  [0m [91m            ~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m45[0m:[93m45[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'AstroComponent'.

[7m45[0m     const { container } = await renderAstro(DashboardLayout as unknown)
[7m  [0m [91m                                            ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m44[0m:[93m56[0m - [91merror[0m[90m ts(7036): [0mDynamic import's specifier must be of type 'string', but here has type 'unknown'.

[7m44[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m  [0m [91m                                                       ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/layouts/__tests__/DashboardLayout.test.ts[0m:[93m44[0m:[93m13[0m - [91merror[0m[90m ts(2339): [0mProperty 'default' does not exist on type 'unknown'.

[7m44[0m     const { default: DashboardLayout } = (await import(compPath as unknown)) as unknown
[7m  [0m [91m            ~~~~~~~[0m

[96msrc/layouts/__tests__/DocumentationLayout.test.tsx[0m:[93m2[0m:[93m7[0m - [91merror[0m[90m ts(2451): [0mCannot redeclare block-scoped variable 'Astro'.

[7m2[0m const Astro = {
[7m [0m [91m      ~~~~~[0m

[96msrc/lib/access-control.ts[0m:[93m1[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'AstroCookies'.

[7m1[0m import type { AstroCookies } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~[0m

[96msrc/lib/analytics.ts[0m:[93m639[0m:[93m27[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'AnalyticsEvent[]'.

[7m639[0m       return eventsJson ? JSON.parse(eventsJson) as unknown : []
[7m   [0m [91m                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/analytics.ts[0m:[93m306[0m:[93m13[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'AnalyticsEvent[]'.

[7m306[0m       const existingEvents: AnalyticsEvent[] = existingEventsJson
[7m   [0m [91m            ~~~~~~~~~~~~~~[0m
[96msrc/lib/analytics.ts[0m:[93m104[0m:[93m66[0m - [91merror[0m[90m ts(1093): [0mType annotation cannot appear on a constructor declaration.

[7m104[0m   private constructor(config: AnalyticsConfig = DEFAULT_CONFIG): void {
[7m   [0m [91m                                                                 ~~~~[0m
[96msrc/lib/analytics.ts[0m:[93m454[0m:[93m58[0m - [93mwarning[0m[90m ts(6385): [0m'platform' is deprecated.

[7m454[0m             typeof navigator !== 'undefined' ? navigator.platform : 'server',
[7m   [0m [93m                                                         ~~~~~~~~[0m

[96msrc/lib/audit.ts[0m:[93m453[0m:[93m23[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'AuditLogEntry[]'.

[7m453[0m     return logsJson ? JSON.parse(logsJson) as unknown : []
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/audit.ts[0m:[93m295[0m:[93m11[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'AuditLogEntry[]'.

[7m295[0m     const existingLogs: AuditLogEntry[] = existingLogsJson
[7m   [0m [91m          ~~~~~~~~~~~~[0m

[96msrc/lib/auth-legacy.ts[0m:[93m219[0m:[93m41[0m - [91merror[0m[90m ts(2322): [0mType 'null' is not assignable to type 'void'.

[7m219[0m     return user ? { userId: user.id } : null
[7m   [0m [91m                                        ~~~~[0m
[96msrc/lib/auth-legacy.ts[0m:[93m219[0m:[93m19[0m - [91merror[0m[90m ts(2322): [0mType '{ userId: string; }' is not assignable to type 'void'.

[7m219[0m     return user ? { userId: user.id } : null
[7m   [0m [91m                  ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/auth-legacy.ts[0m:[93m216[0m:[93m42[0m - [91merror[0m[90m ts(1064): [0mThe return type of an async function or method must be the global Promise<T> type. Did you mean to write 'Promise<void>'?

[7m216[0m   async verifySession(request: Request): void {
[7m   [0m [91m                                         ~~~~[0m
[96msrc/lib/auth-legacy.ts[0m:[93m1[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'AstroCookies'.

[7m1[0m import type { AstroCookies } from 'astro'
[7m [0m [91m              ~~~~~~~~~~~~[0m

[96msrc/lib/cache.ts[0m:[93m57[0m:[93m25[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.

[7m57[0m       this.store.delete(oldestKey)
[7m  [0m [91m                        ~~~~~~~~~[0m
[96msrc/lib/cache.ts[0m:[93m20[0m:[93m39[0m - [91merror[0m[90m ts(1093): [0mType annotation cannot appear on a constructor declaration.

[7m20[0m   constructor(options: CacheOptions): void {
[7m  [0m [91m                                      ~~~~[0m

[96msrc/lib/crypto.ts[0m:[93m51[0m:[93m27[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m51[0m         const dataArray = parts[2].split(',').map(Number)
[7m  [0m [91m                          ~~~~~~~~[0m

[96msrc/lib/email.ts[0m:[93m46[0m:[93m37[0m - [91merror[0m[90m ts(1093): [0mType annotation cannot appear on a constructor declaration.

[7m46[0m   constructor(config: EmailConfig): void {
[7m  [0m [91m                                    ~~~~[0m
[96msrc/lib/email.ts[0m:[93m66[0m:[93m73[0m - [93mwarning[0m[90m ts(6385): [0m'(from: number, length?: number | undefined): string' is deprecated.

[7m66[0m       const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
[7m  [0m [93m                                                                        ~~~~~~[0m

[96msrc/lib/encryption.ts[0m:[93m164[0m:[93m23[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'string'.

[7m164[0m     return JSON.parse(decoder.decode(decrypted) as unknown)
[7m   [0m [91m                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/lib/logging.ts[0m:[93m66[0m:[93m66[0m - [91merror[0m[90m ts(1093): [0mType annotation cannot appear on a constructor declaration.

[7m66[0m   constructor(level: LogLevel = LogLevel.INFO, prefix?: string): void {
[7m  [0m [91m                                                                 ~~~~[0m

[96msrc/lib/markdown.ts[0m:[93m101[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

[7m101[0m       url: match[2],
[7m   [0m [91m      ~~~[0m
[96msrc/lib/markdown.ts[0m:[93m100[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

[7m100[0m       text: match[1],
[7m   [0m [91m      ~~~~[0m
[96msrc/lib/markdown.ts[0m:[93m76[0m:[93m7[0m - [91merror[0m[90m ts(2322): [0mType 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

[7m76[0m       text: match[2],
[7m  [0m [91m      ~~~~[0m
[96msrc/lib/markdown.ts[0m:[93m75[0m:[93m14[0m - [91merror[0m[90m ts(2532): [0mObject is possibly 'undefined'.

[7m75[0m       level: match[1].length,
[7m  [0m [91m             ~~~~~~~~[0m

[96msrc/lib/memory.ts[0m:[93m105[0m:[93m20[0m - [91merror[0m[90m ts(18048): [0m'bVal' is possibly 'undefined'.

[7m105[0m         if (aVal > bVal) return options.sortOrder === 'desc' ? -1 : 1;
[7m   [0m [91m                   ~~~~[0m
[96msrc/lib/memory.ts[0m:[93m105[0m:[93m13[0m - [91merror[0m[90m ts(18048): [0m'aVal' is possibly 'undefined'.

[7m105[0m         if (aVal > bVal) return options.sortOrder === 'desc' ? -1 : 1;
[7m   [0m [91m            ~~~~[0m
[96msrc/lib/memory.ts[0m:[93m104[0m:[93m20[0m - [91merror[0m[90m ts(18048): [0m'bVal' is possibly 'undefined'.

[7m104[0m         if (aVal < bVal) return options.sortOrder === 'desc' ? 1 : -1;
[7m   [0m [91m                   ~~~~[0m
[96msrc/lib/memory.ts[0m:[93m104[0m:[93m13[0m - [91merror[0m[90m ts(18048): [0m'aVal' is possibly 'undefined'.

[7m104[0m         if (aVal < bVal) return options.sortOrder === 'desc' ? 1 : -1;
[7m   [0m [91m            ~~~~[0m
[96msrc/lib/memory.ts[0m:[93m67[0m:[93m5[0m - [91merror[0m[90m ts(2322): [0mType 'Memory | undefined' is not assignable to type 'Memory | null'.
  Type 'undefined' is not assignable to type 'Memory | null'.

[7m67[0m     return this.memories[memoryIndex];
[7m  [0m [91m    ~~~~~~[0m
[96msrc/lib/memory.ts[0m:[93m63[0m:[93m22[0m - [91merror[0m[90m ts(18048): [0m'memory' is possibly 'undefined'.

[7m63[0m       metadata: { ...memory.metadata, ...options.metadata },
[7m  [0m [91m                     ~~~~~~[0m
[96msrc/lib/memory.ts[0m:[93m62[0m:[93m29[0m - [91merror[0m[90m ts(18048): [0m'memory' is possibly 'undefined'.

[7m62[0m       tags: options.tags ?? memory.tags,
[7m  [0m [91m                            ~~~~~~[0m
[96msrc/lib/memory.ts[0m:[93m61[0m:[93m35[0m - [91merror[0m[90m ts(18048): [0m'memory' is possibly 'undefined'.

[7m61[0m       content: options.content ?? memory.content,
[7m  [0m [91m                                  ~~~~~~[0m
[96msrc/lib/memory.ts[0m:[93m59[0m:[93m5[0m - [91merror[0m[90m ts(2322): [0mType '{ content: string; tags: string[] | undefined; metadata: { [x: string]: unknown; }; updatedAt: Date; id?: string | undefined; userId?: string | undefined; createdAt?: Date | undefined; }' is not assignable to type 'Memory'.
  Types of property 'id' are incompatible.

[7m59[0m     this.memories[memoryIndex] = {
[7m  [0m [91m    ~~~~~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/memory.ts[0m:[93m40[0m:[93m38[0m - [93mwarning[0m[90m ts(6385): [0m'(from: number, length?: number | undefined): string' is deprecated.

[7m40[0m       id: Math.random().toString(36).substr(2, 9),
[7m  [0m [93m                                     ~~~~~~[0m

[96msrc/lib/redis.ts[0m:[93m62[0m:[93m22[0m - [91merror[0m[90m ts(2769): [0mNo overload matches this call.
  Overload 1 of 8, '(path: string, options: RedisOptions): Redis', gave the following error.
  Overload 2 of 8, '(port: number, options: RedisOptions): Redis', gave the following error.
  Overload 3 of 8, '(port: number, host: string): Redis', gave the following error.

[7m62[0m     return new Redis(restUrl, {
[7m  [0m [91m                     ~~~~~~~[0m

[96msrc/lib/security.ts[0m:[93m446[0m:[93m5[0m - [91merror[0m[90m ts(2322): [0mType 'unknown' is not assignable to type 'Record<string, unknown> | null'.

[7m446[0m     return payload
[7m   [0m [91m    ~~~~~~[0m
[96msrc/lib/security.ts[0m:[93m442[0m:[93m24[0m - [91merror[0m[90m ts(18046): [0m'payload' is of type 'unknown'.

[7m442[0m     if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
[7m   [0m [91m                       ~~~~~~~[0m
[96msrc/lib/security.ts[0m:[93m442[0m:[93m9[0m - [91merror[0m[90m ts(18046): [0m'payload' is of type 'unknown'.

[7m442[0m     if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
[7m   [0m [91m        ~~~~~~~[0m

[96msrc/lib/admin/middleware.ts[0m:[93m78[0m:[93m3[0m - [91merror[0m[90m ts(2322): [0mType '(context: APIContext) => Promise<Response | null>' is not assignable to type 'void'.

[7m78[0m   return async (context: APIContext) => {
[7m  [0m [91m  ~~~~~~[0m
[96msrc/lib/admin/middleware.ts[0m:[93m7[0m:[93m15[0m - [91merror[0m[90m ts(2305): [0mModule '"astro"' has no exported member 'APIContext'.

[7m7[0m import type { APIContext } from 'astro'
[7m [0m [91m              ~~~~~~~~~~[0m

[96msrc/lib/ai/PixelatedEmpathyAgent.ts[0m:[93m168[0m:[93m41[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'string'.

[7m168[0m                 const data = JSON.parse(line.slice(6) as unknown);
[7m   [0m [91m                                        ~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m1051[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'dispose' does not exist on type 'PythonBiasDetectionBridge'.

[7m1051[0m       await this.pythonBridge.dispose()
[7m    [0m [91m                              ~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m1043[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'unregisterAlertSystem' does not exist on type 'PythonBiasDetectionBridge'.

[7m1043[0m       await this.pythonBridge.unregisterAlertSystem({
[7m    [0m [91m                              ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m1004[0m:[93m48[0m - [91merror[0m[90m ts(2339): [0mProperty 'getAlertStatistics' does not exist on type 'PythonBiasDetectionBridge'.

[7m1004[0m       const response = await this.pythonBridge.getAlertStatistics({
[7m    [0m [91m                                               ~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m978[0m:[93m48[0m - [91merror[0m[90m ts(2339): [0mProperty 'getRecentAlerts' does not exist on type 'PythonBiasDetectionBridge'.

[7m978[0m       const response = await this.pythonBridge.getRecentAlerts({
[7m   [0m [91m                                               ~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m958[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'sendSystemNotification' does not exist on type 'PythonBiasDetectionBridge'.

[7m958[0m       await this.pythonBridge.sendSystemNotification({
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m934[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'acknowledgeAlert' does not exist on type 'PythonBiasDetectionBridge'.

[7m934[0m       await this.pythonBridge.acknowledgeAlert({
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m913[0m:[93m52[0m - [91merror[0m[90m ts(2339): [0mProperty 'getActiveAlerts' does not exist on type 'PythonBiasDetectionBridge'.

[7m913[0m       const serverAlerts = await this.pythonBridge.getActiveAlerts();
[7m   [0m [91m                                                   ~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m853[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'sendNotification' does not exist on type 'PythonBiasDetectionBridge'.

[7m853[0m       await this.pythonBridge.sendNotification({
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m764[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'escalateAlert' does not exist on type 'PythonBiasDetectionBridge'.

[7m764[0m       await this.pythonBridge.escalateAlert({
[7m   [0m [91m                              ~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m627[0m:[93m35[0m - [91merror[0m[90m ts(2339): [0mProperty 'storeAlerts' does not exist on type 'PythonBiasDetectionBridge'.

[7m627[0m           await this.pythonBridge.storeAlerts(
[7m   [0m [91m                                  ~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m580[0m:[93m56[0m - [91merror[0m[90m ts(2339): [0mProperty 'checkAlerts' does not exist on type 'PythonBiasDetectionBridge'.

[7m580[0m         serverAlertsResponse = await this.pythonBridge.checkAlerts({
[7m   [0m [91m                                                       ~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/alerts-system.ts[0m:[93m538[0m:[93m33[0m - [91merror[0m[90m ts(2339): [0mProperty 'registerAlertSystem' does not exist on type 'PythonBiasDetectionBridge'.

[7m538[0m         await this.pythonBridge.registerAlertSystem({
[7m   [0m [91m                                ~~~~~~~~~~~~~~~~~~~[0m

[96msrc/lib/ai/bias-detection/audit.ts[0m:[93m464[0m:[93m62[0m - [93mwarning[0m[90m ts(6385): [0m'(from: number, length?: number | undefined): string' is deprecated.

[7m464[0m     return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
[7m   [0m [93m                                                             ~~~~~~[0m

[96msrc/lib/ai/bias-detection/cache.ts[0m:[93m909[0m:[93m15[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'cacheData' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m909[0m           let cacheData
[7m   [0m [93m              ~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/cache.ts[0m:[93m553[0m:[93m15[0m - [93mwarning[0m[90m ts(7043): [0mVariable 'cacheData' implicitly has an 'any' type, but a better type may be inferred from usage.

[7m553[0m           let cacheData
[7m   [0m [93m              ~~~~~~~~~[0m

[96msrc/lib/ai/bias-detection/connection-pool.ts[0m:[93m111[0m:[93m65[0m - [93mwarning[0m[90m ts(6385): [0m'(from: number, length?: number | undefined): string' is deprecated.

[7m111[0m     const id = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
[7m   [0m [93m                                                                ~~~~~~[0m

[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m494[0m:[93m29[0m - [91merror[0m[90m ts(2339): [0mProperty 'dispose' does not exist on type 'PythonBiasDetectionBridge'.

[7m494[0m     await this.pythonBridge.dispose()
[7m   [0m [91m                            ~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m449[0m:[93m33[0m - [91merror[0m[90m ts(2339): [0mProperty 'storeMetrics' does not exist on type 'PythonBiasDetectionBridge'.

[7m449[0m         await this.pythonBridge.storeMetrics([
[7m   [0m [91m                                ~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m400[0m:[93m38[0m - [91merror[0m[90m ts(2339): [0mProperty 'getSessionData' does not exist on type 'PythonBiasDetectionBridge'.

[7m400[0m       return await this.pythonBridge.getSessionData(sessionId)
[7m   [0m [91m                                     ~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m374[0m:[93m48[0m - [91merror[0m[90m ts(2339): [0mProperty 'getPerformanceMetrics' does not exist on type 'PythonBiasDetectionBridge'.

[7m374[0m       const response = await this.pythonBridge.getPerformanceMetrics()
[7m   [0m [91m                                               ~~~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m260[0m:[93m48[0m - [91merror[0m[90m ts(2339): [0mProperty 'getDashboardMetrics' does not exist on type 'PythonBiasDetectionBridge'.

[7m260[0m       const response = await this.pythonBridge.getDashboardMetrics()
[7m   [0m [91m                                               ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m242[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'recordReportMetric' does not exist on type 'PythonBiasDetectionBridge'.

[7m242[0m       await this.pythonBridge.recordReportMetric({
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m165[0m:[93m38[0m - [91merror[0m[90m ts(2339): [0mProperty 'getDashboardMetrics' does not exist on type 'PythonBiasDetectionBridge'.

[7m165[0m       return await this.pythonBridge.getDashboardMetrics({
[7m   [0m [91m                                     ~~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m119[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'sendAnalysisMetric' does not exist on type 'PythonBiasDetectionBridge'.

[7m119[0m       await this.pythonBridge.sendAnalysisMetric(metricData)
[7m   [0m [91m                              ~~~~~~~~~~~~~~~~~~[0m
[96msrc/lib/ai/bias-detection/metrics-collector.ts[0m:[93m83[0m:[93m31[0m - [91merror[0m[90m ts(2339): [0mProperty 'sendMetricsBatch' does not exist on type 'PythonBiasDetectionBridge'.

[7m83[0m       await this.pythonBridge.sendMetricsBatch(metrics)
[7m  [0m [91m                              ~~~~~~~~~~~~~~~~[0m

[96msrc/lib/ai/bias-detection/performance-optimizer.ts[0m:[93m524[0m:[93m59[0m - [93mwarning[0m[90m ts(6385): [0m'(from: number, length?: number | undefined): string' is deprecated.

[7m524[0m       id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
[7m   [0m [93m                                                          ~~~~~~[0m

[96msrc/lib/ai/bias-detection/privacy.ts[0m:[93m19[0m:[93m40[0m - [91merror[0m[90m ts(2345): [0mArgument of type 'unknown' is not assignable to parameter of type 'string'.

[7m19[0m   const anonymizedSession = JSON.parse(JSON.stringify(session) as unknown)
[7m  [0m [91m                                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~[0m

[96msrc/lib/ai/bias-detection/python-bridge.ts[0m:[93m144[0m:[93m66[0m - [93mwarning[0m[90m ts(6385): [0m'(from: number, length?: number | undefined): string' is deprecated.

[7m144[0m       const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
[7m   [0m [93m                                                                 ~~~~~~[0m


<--- Last few GCs --->

[2648:0x77a6000]   104101 ms: Mark-Compact 2041.1 (2086.0) -> 2039.8 (2090.7) MB, pooled: 0 MB, 1100.42 / 0.00 ms  (average mu = 0.075, current mu = 0.012) allocation failure; scavenge might not succeed
[2648:0x77a6000]   105217 ms: Mark-Compact (reduce) 2043.9 (2091.0) -> 2043.1 (2087.2) MB, pooled: 0 MB, 573.39 / 0.00 ms  (+ 329.8 ms in 0 steps since start of marking, biggest step 0.0 ms, walltime since start of marking 942 ms) (average mu = 0.131, cur

<--- JS stacktrace --->

FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0xe16044 node::OOMErrorHandler(char const*, v8::OOMDetails const&) [node]
 2: 0x11e0dd0 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [node]
 3: 0x11e10a7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [node]
 4: 0x140e985  [node]
 5: 0x140e9b3  [node]
 6: 0x1427a8a  [node]
 7: 0x142ac58  [node]
 8: 0x1c90921  [node]
Aborted
 ELIFECYCLE  Command failed with exit code 134.
