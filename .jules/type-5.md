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
