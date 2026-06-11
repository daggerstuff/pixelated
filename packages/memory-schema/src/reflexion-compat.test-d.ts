/**
 * Compile-time structural compatibility with src/lib/memory/reflection/reflexion.ts.
 * PIX-3897 acceptance criterion #2.
 */
import type {
  ActionFeedbackPair as LocalActionFeedbackPair,
  ReflexionResult as LocalReflexionResult,
  VerbalReflection as LocalVerbalReflection,
} from '../../../src/lib/memory/reflection/reflexion'

import type {
  ActionFeedbackPair,
  ReflexionResult,
  VerbalReflection,
} from './reflection'

type AssertEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T,
>() => T extends B ? 1 : 2
  ? true
  : false

export type ReflexionResultCompat = AssertEqual<
  LocalReflexionResult,
  ReflexionResult
>
export type VerbalReflectionCompat = AssertEqual<
  LocalVerbalReflection,
  VerbalReflection
>
export type ActionFeedbackPairCompat = AssertEqual<
  LocalActionFeedbackPair,
  ActionFeedbackPair
>
