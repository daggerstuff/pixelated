'use strict'

// ESM compatibility for React
// This is a manually created ESM shim for React

// Handle production vs development builds
const React =
  process.env.NODE_ENV === 'production'
    ? require('./cjs/react.production.min.js')
    : require('./cjs/react.development.js')

// Export React as default
export default React

// Re-export all React properties
export const {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createFactory,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  startTransition,
  version,
} = React
