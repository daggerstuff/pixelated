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
