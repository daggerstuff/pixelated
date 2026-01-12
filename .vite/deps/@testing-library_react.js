import {
  buildQueries,
  configure,
  createEvent,
  findAllByAltText,
  findAllByDisplayValue,
  findAllByLabelText,
  findAllByPlaceholderText,
  findAllByRole,
  findAllByTestId,
  findAllByText,
  findAllByTitle,
  findByAltText,
  findByDisplayValue,
  findByLabelText,
  findByPlaceholderText,
  findByRole,
  findByTestId,
  findByText,
  findByTitle,
  fireEvent,
  getAllByAltText,
  getAllByDisplayValue,
  getAllByLabelTextWithSuggestions,
  getAllByPlaceholderText,
  getAllByRole,
  getAllByTestId,
  getAllByText,
  getAllByTitle,
  getByAltText,
  getByDisplayValue,
  getByLabelTextWithSuggestions,
  getByPlaceholderText,
  getByRole,
  getByTestId,
  getByText,
  getByTitle,
  getConfig,
  getDefaultNormalizer,
  getElementError,
  getMultipleElementsFoundError,
  getNodeText,
  getQueriesForElement,
  getRoles,
  getSuggestedQuery,
  isInaccessible,
  logDOM,
  logRoles,
  makeFindQuery,
  makeGetAllQuery,
  makeSingleQuery,
  prettyDOM,
  prettyFormat,
  queries,
  queryAllByAltTextWithSuggestions,
  queryAllByAttribute,
  queryAllByDisplayValueWithSuggestions,
  queryAllByLabelTextWithSuggestions,
  queryAllByPlaceholderTextWithSuggestions,
  queryAllByRoleWithSuggestions,
  queryAllByTestIdWithSuggestions,
  queryAllByTextWithSuggestions,
  queryAllByTitleWithSuggestions,
  queryByAltText,
  queryByAttribute,
  queryByDisplayValue,
  queryByLabelText,
  queryByPlaceholderText,
  queryByRole,
  queryByTestId,
  queryByText,
  queryByTitle,
  queryHelpers,
  screen,
  waitForElementToBeRemoved,
  waitForWrapper,
  wrapAllByQueryWithSuggestion,
  wrapSingleQueryWithSuggestion
} from "./chunk-GAQVBBJI.js";
import {
  require_client
} from "./chunk-I2XJTFW5.js";
import {
  require_react_dom
} from "./chunk-CHY6K7RD.js";
import {
  require_react
} from "./chunk-VZKCEW2Y.js";
import {
  __commonJS,
  __toESM
} from "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/react-dom@19.2.3_react@19.2.3/node_modules/react-dom/cjs/react-dom-test-utils.development.js
var require_react_dom_test_utils_development = __commonJS({
  "node_modules/.pnpm/react-dom@19.2.3_react@19.2.3/node_modules/react-dom/cjs/react-dom-test-utils.development.js"(exports) {
    "use strict";
    (function() {
      var React2 = require_react(), didWarnAboutUsingAct = false;
      exports.act = function(callback) {
        false === didWarnAboutUsingAct && (didWarnAboutUsingAct = true, console.error(
          "`ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom/test-utils`. See https://react.dev/warnings/react-dom-test-utils for more info."
        ));
        return React2.act(callback);
      };
    })();
  }
});

// node_modules/.pnpm/react-dom@19.2.3_react@19.2.3/node_modules/react-dom/test-utils.js
var require_test_utils = __commonJS({
  "node_modules/.pnpm/react-dom@19.2.3_react@19.2.3/node_modules/react-dom/test-utils.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_react_dom_test_utils_development();
    }
  }
});

// node_modules/.pnpm/@testing-library+react@16.3.1_@testing-library+dom@10.4.1_@types+react-dom@19.2.3_@type_68c5b21a70acecf0fbbfd97f51128017/node_modules/@testing-library/react/dist/@testing-library/react.esm.js
var React = __toESM(require_react());
var DeprecatedReactTestUtils = __toESM(require_test_utils());
var import_react_dom = __toESM(require_react_dom());
var ReactDOMClient = __toESM(require_client());
var reactAct = typeof React.act === "function" ? React.act : DeprecatedReactTestUtils.act;
function getGlobalThis() {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw new Error("unable to locate global object");
}
function setIsReactActEnvironment(isReactActEnvironment) {
  getGlobalThis().IS_REACT_ACT_ENVIRONMENT = isReactActEnvironment;
}
function getIsReactActEnvironment() {
  return getGlobalThis().IS_REACT_ACT_ENVIRONMENT;
}
function withGlobalActEnvironment(actImplementation) {
  return (callback) => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(true);
    try {
      let callbackNeedsToBeAwaited = false;
      const actResult = actImplementation(() => {
        const result = callback();
        if (result !== null && typeof result === "object" && typeof result.then === "function") {
          callbackNeedsToBeAwaited = true;
        }
        return result;
      });
      if (callbackNeedsToBeAwaited) {
        const thenable = actResult;
        return {
          then: (resolve, reject) => {
            thenable.then((returnValue) => {
              setIsReactActEnvironment(previousActEnvironment);
              resolve(returnValue);
            }, (error) => {
              setIsReactActEnvironment(previousActEnvironment);
              reject(error);
            });
          }
        };
      } else {
        setIsReactActEnvironment(previousActEnvironment);
        return actResult;
      }
    } catch (error) {
      setIsReactActEnvironment(previousActEnvironment);
      throw error;
    }
  };
}
var act3 = withGlobalActEnvironment(reactAct);
var fireEvent2 = (...args) => fireEvent(...args);
Object.keys(fireEvent).forEach((key) => {
  fireEvent2[key] = (...args) => fireEvent[key](...args);
});
var mouseEnter = fireEvent2.mouseEnter;
var mouseLeave = fireEvent2.mouseLeave;
fireEvent2.mouseEnter = (...args) => {
  mouseEnter(...args);
  return fireEvent2.mouseOver(...args);
};
fireEvent2.mouseLeave = (...args) => {
  mouseLeave(...args);
  return fireEvent2.mouseOut(...args);
};
var pointerEnter = fireEvent2.pointerEnter;
var pointerLeave = fireEvent2.pointerLeave;
fireEvent2.pointerEnter = (...args) => {
  pointerEnter(...args);
  return fireEvent2.pointerOver(...args);
};
fireEvent2.pointerLeave = (...args) => {
  pointerLeave(...args);
  return fireEvent2.pointerOut(...args);
};
var select = fireEvent2.select;
fireEvent2.select = (node, init) => {
  select(node, init);
  node.focus();
  fireEvent2.keyUp(node, init);
};
var blur = fireEvent2.blur;
var focus = fireEvent2.focus;
fireEvent2.blur = (...args) => {
  fireEvent2.focusOut(...args);
  return blur(...args);
};
fireEvent2.focus = (...args) => {
  fireEvent2.focusIn(...args);
  return focus(...args);
};
var configForRTL = {
  reactStrictMode: false
};
function getConfig2() {
  return {
    ...getConfig(),
    ...configForRTL
  };
}
function configure2(newConfig) {
  if (typeof newConfig === "function") {
    newConfig = newConfig(getConfig2());
  }
  const {
    reactStrictMode,
    ...configForDTL
  } = newConfig;
  configure(configForDTL);
  configForRTL = {
    ...configForRTL,
    reactStrictMode
  };
}
function jestFakeTimersAreEnabled() {
  if (typeof jest !== "undefined" && jest !== null) {
    return (
      // legacy timers
      setTimeout._isMockFunction === true || // modern timers
      // eslint-disable-next-line prefer-object-has-own -- No Object.hasOwn in all target environments we support.
      Object.prototype.hasOwnProperty.call(setTimeout, "clock")
    );
  }
  return false;
}
configure({
  unstable_advanceTimersWrapper: (cb) => {
    return act3(cb);
  },
  // We just want to run `waitFor` without IS_REACT_ACT_ENVIRONMENT
  // But that's not necessarily how `asyncWrapper` is used since it's a public method.
  // Let's just hope nobody else is using it.
  asyncWrapper: async (cb) => {
    const previousActEnvironment = getIsReactActEnvironment();
    setIsReactActEnvironment(false);
    try {
      const result = await cb();
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 0);
        if (jestFakeTimersAreEnabled()) {
          jest.advanceTimersByTime(0);
        }
      });
      return result;
    } finally {
      setIsReactActEnvironment(previousActEnvironment);
    }
  },
  eventWrapper: (cb) => {
    let result;
    act3(() => {
      result = cb();
    });
    return result;
  }
});
var mountedContainers = /* @__PURE__ */ new Set();
var mountedRootEntries = [];
function strictModeIfNeeded(innerElement, reactStrictMode) {
  return reactStrictMode ?? getConfig2().reactStrictMode ? React.createElement(React.StrictMode, null, innerElement) : innerElement;
}
function wrapUiIfNeeded(innerElement, wrapperComponent) {
  return wrapperComponent ? React.createElement(wrapperComponent, null, innerElement) : innerElement;
}
function createConcurrentRoot(container, {
  hydrate,
  onCaughtError,
  onRecoverableError,
  ui,
  wrapper: WrapperComponent,
  reactStrictMode
}) {
  let root;
  if (hydrate) {
    act3(() => {
      root = ReactDOMClient.hydrateRoot(container, strictModeIfNeeded(wrapUiIfNeeded(ui, WrapperComponent), reactStrictMode), {
        onCaughtError,
        onRecoverableError
      });
    });
  } else {
    root = ReactDOMClient.createRoot(container, {
      onCaughtError,
      onRecoverableError
    });
  }
  return {
    hydrate() {
      if (!hydrate) {
        throw new Error("Attempted to hydrate a non-hydrateable root. This is a bug in `@testing-library/react`.");
      }
    },
    render(element) {
      root.render(element);
    },
    unmount() {
      root.unmount();
    }
  };
}
function createLegacyRoot(container) {
  return {
    hydrate(element) {
      import_react_dom.default.hydrate(element, container);
    },
    render(element) {
      import_react_dom.default.render(element, container);
    },
    unmount() {
      import_react_dom.default.unmountComponentAtNode(container);
    }
  };
}
function renderRoot(ui, {
  baseElement,
  container,
  hydrate,
  queries: queries2,
  root,
  wrapper: WrapperComponent,
  reactStrictMode
}) {
  act3(() => {
    if (hydrate) {
      root.hydrate(strictModeIfNeeded(wrapUiIfNeeded(ui, WrapperComponent), reactStrictMode), container);
    } else {
      root.render(strictModeIfNeeded(wrapUiIfNeeded(ui, WrapperComponent), reactStrictMode), container);
    }
  });
  return {
    container,
    baseElement,
    debug: (el = baseElement, maxLength, options) => Array.isArray(el) ? (
      // eslint-disable-next-line no-console
      el.forEach((e) => console.log(prettyDOM(e, maxLength, options)))
    ) : (
      // eslint-disable-next-line no-console,
      console.log(prettyDOM(el, maxLength, options))
    ),
    unmount: () => {
      act3(() => {
        root.unmount();
      });
    },
    rerender: (rerenderUi) => {
      renderRoot(rerenderUi, {
        container,
        baseElement,
        root,
        wrapper: WrapperComponent,
        reactStrictMode
      });
    },
    asFragment: () => {
      if (typeof document.createRange === "function") {
        return document.createRange().createContextualFragment(container.innerHTML);
      } else {
        const template = document.createElement("template");
        template.innerHTML = container.innerHTML;
        return template.content;
      }
    },
    ...getQueriesForElement(baseElement, queries2)
  };
}
function render(ui, {
  container,
  baseElement = container,
  legacyRoot = false,
  onCaughtError,
  onUncaughtError,
  onRecoverableError,
  queries: queries2,
  hydrate = false,
  wrapper,
  reactStrictMode
} = {}) {
  if (onUncaughtError !== void 0) {
    throw new Error("onUncaughtError is not supported. The `render` call will already throw on uncaught errors.");
  }
  if (legacyRoot && typeof import_react_dom.default.render !== "function") {
    const error = new Error("`legacyRoot: true` is not supported in this version of React. If your app runs React 19 or later, you should remove this flag. If your app runs React 18 or earlier, visit https://react.dev/blog/2022/03/08/react-18-upgrade-guide for upgrade instructions.");
    Error.captureStackTrace(error, render);
    throw error;
  }
  if (!baseElement) {
    baseElement = document.body;
  }
  if (!container) {
    container = baseElement.appendChild(document.createElement("div"));
  }
  let root;
  if (!mountedContainers.has(container)) {
    const createRootImpl = legacyRoot ? createLegacyRoot : createConcurrentRoot;
    root = createRootImpl(container, {
      hydrate,
      onCaughtError,
      onRecoverableError,
      ui,
      wrapper,
      reactStrictMode
    });
    mountedRootEntries.push({
      container,
      root
    });
    mountedContainers.add(container);
  } else {
    mountedRootEntries.forEach((rootEntry) => {
      if (rootEntry.container === container) {
        root = rootEntry.root;
      }
    });
  }
  return renderRoot(ui, {
    container,
    baseElement,
    queries: queries2,
    hydrate,
    wrapper,
    root,
    reactStrictMode
  });
}
function cleanup() {
  mountedRootEntries.forEach(({
    root,
    container
  }) => {
    act3(() => {
      root.unmount();
    });
    if (container.parentNode === document.body) {
      document.body.removeChild(container);
    }
  });
  mountedRootEntries.length = 0;
  mountedContainers.clear();
}
function renderHook(renderCallback, options = {}) {
  const {
    initialProps,
    ...renderOptions
  } = options;
  if (renderOptions.legacyRoot && typeof import_react_dom.default.render !== "function") {
    const error = new Error("`legacyRoot: true` is not supported in this version of React. If your app runs React 19 or later, you should remove this flag. If your app runs React 18 or earlier, visit https://react.dev/blog/2022/03/08/react-18-upgrade-guide for upgrade instructions.");
    Error.captureStackTrace(error, renderHook);
    throw error;
  }
  const result = React.createRef();
  function TestComponent({
    renderCallbackProps
  }) {
    const pendingResult = renderCallback(renderCallbackProps);
    React.useEffect(() => {
      result.current = pendingResult;
    });
    return null;
  }
  const {
    rerender: baseRerender,
    unmount
  } = render(React.createElement(TestComponent, {
    renderCallbackProps: initialProps
  }), renderOptions);
  function rerender(rerenderCallbackProps) {
    return baseRerender(React.createElement(TestComponent, {
      renderCallbackProps: rerenderCallbackProps
    }));
  }
  return {
    result,
    rerender,
    unmount
  };
}
if (typeof process === "undefined" || !process.env?.RTL_SKIP_AUTO_CLEANUP) {
  if (typeof afterEach === "function") {
    afterEach(() => {
      cleanup();
    });
  } else if (typeof teardown === "function") {
    teardown(() => {
      cleanup();
    });
  }
  if (typeof beforeAll === "function" && typeof afterAll === "function") {
    let previousIsReactActEnvironment = getIsReactActEnvironment();
    beforeAll(() => {
      previousIsReactActEnvironment = getIsReactActEnvironment();
      setIsReactActEnvironment(true);
    });
    afterAll(() => {
      setIsReactActEnvironment(previousIsReactActEnvironment);
    });
  }
}
export {
  act3 as act,
  buildQueries,
  cleanup,
  configure2 as configure,
  createEvent,
  findAllByAltText,
  findAllByDisplayValue,
  findAllByLabelText,
  findAllByPlaceholderText,
  findAllByRole,
  findAllByTestId,
  findAllByText,
  findAllByTitle,
  findByAltText,
  findByDisplayValue,
  findByLabelText,
  findByPlaceholderText,
  findByRole,
  findByTestId,
  findByText,
  findByTitle,
  fireEvent2 as fireEvent,
  getAllByAltText,
  getAllByDisplayValue,
  getAllByLabelTextWithSuggestions as getAllByLabelText,
  getAllByPlaceholderText,
  getAllByRole,
  getAllByTestId,
  getAllByText,
  getAllByTitle,
  getByAltText,
  getByDisplayValue,
  getByLabelTextWithSuggestions as getByLabelText,
  getByPlaceholderText,
  getByRole,
  getByTestId,
  getByText,
  getByTitle,
  getConfig2 as getConfig,
  getDefaultNormalizer,
  getElementError,
  getMultipleElementsFoundError,
  getNodeText,
  getQueriesForElement,
  getRoles,
  getSuggestedQuery,
  isInaccessible,
  logDOM,
  logRoles,
  makeFindQuery,
  makeGetAllQuery,
  makeSingleQuery,
  prettyDOM,
  prettyFormat,
  queries,
  queryAllByAltTextWithSuggestions as queryAllByAltText,
  queryAllByAttribute,
  queryAllByDisplayValueWithSuggestions as queryAllByDisplayValue,
  queryAllByLabelTextWithSuggestions as queryAllByLabelText,
  queryAllByPlaceholderTextWithSuggestions as queryAllByPlaceholderText,
  queryAllByRoleWithSuggestions as queryAllByRole,
  queryAllByTestIdWithSuggestions as queryAllByTestId,
  queryAllByTextWithSuggestions as queryAllByText,
  queryAllByTitleWithSuggestions as queryAllByTitle,
  queryByAltText,
  queryByAttribute,
  queryByDisplayValue,
  queryByLabelText,
  queryByPlaceholderText,
  queryByRole,
  queryByTestId,
  queryByText,
  queryByTitle,
  queryHelpers,
  render,
  renderHook,
  screen,
  waitForWrapper as waitFor,
  waitForElementToBeRemoved,
  getQueriesForElement as within,
  wrapAllByQueryWithSuggestion,
  wrapSingleQueryWithSuggestion
};
//# sourceMappingURL=@testing-library_react.js.map
