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
