import {
  getConfig
} from "./chunk-GAQVBBJI.js";
import {
  __export
} from "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/isElementType.js
function isElementType(element, tag, props) {
  if (element.namespaceURI && element.namespaceURI !== "http://www.w3.org/1999/xhtml") {
    return false;
  }
  tag = Array.isArray(tag) ? tag : [
    tag
  ];
  if (!tag.includes(element.tagName.toLowerCase())) {
    return false;
  }
  if (props) {
    return Object.entries(props).every(([k, v]) => element[k] === v);
  }
  return true;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/getWindow.js
function getWindow(node) {
  var _node_ownerDocument;
  if (isDocument(node) && node.defaultView) {
    return node.defaultView;
  } else if ((_node_ownerDocument = node.ownerDocument) === null || _node_ownerDocument === void 0 ? void 0 : _node_ownerDocument.defaultView) {
    return node.ownerDocument.defaultView;
  }
  throw new Error(`Could not determine window of node. Node was ${describe(node)}`);
}
function isDocument(node) {
  return node.nodeType === 9;
}
function describe(val) {
  return typeof val === "function" ? `function ${val.name}` : val === null ? "null" : String(val);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/Blob.js
function readBlobText(blob, FileReader) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = rej;
    fr.onabort = rej;
    fr.onload = () => {
      res(String(fr.result));
    };
    fr.readAsText(blob);
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/FileList.js
function createFileList(window, files) {
  const list = {
    ...files,
    length: files.length,
    item: (index) => list[index],
    [Symbol.iterator]: function* nextFile() {
      for (let i = 0; i < list.length; i++) {
        yield list[i];
      }
    }
  };
  list.constructor = window.FileList;
  if (window.FileList) {
    Object.setPrototypeOf(list, window.FileList.prototype);
  }
  Object.freeze(list);
  return list;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/DataTransfer.js
function _define_property(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var DataTransferItemStub = class {
  getAsFile() {
    return this.file;
  }
  getAsString(callback) {
    if (typeof this.data === "string") {
      callback(this.data);
    }
  }
  /* istanbul ignore next */
  webkitGetAsEntry() {
    throw new Error("not implemented");
  }
  constructor(dataOrFile, type3) {
    _define_property(this, "kind", void 0);
    _define_property(this, "type", void 0);
    _define_property(this, "file", null);
    _define_property(this, "data", void 0);
    if (typeof dataOrFile === "string") {
      this.kind = "string";
      this.type = String(type3);
      this.data = dataOrFile;
    } else {
      this.kind = "file";
      this.type = dataOrFile.type;
      this.file = dataOrFile;
    }
  }
};
var DataTransferItemListStub = class extends Array {
  add(...args) {
    const item = new DataTransferItemStub(args[0], args[1]);
    this.push(item);
    return item;
  }
  clear() {
    this.splice(0, this.length);
  }
  remove(index) {
    this.splice(index, 1);
  }
};
function getTypeMatcher(type3, exact) {
  const [group, sub] = type3.split("/");
  const isGroup = !sub || sub === "*";
  return (item) => {
    return exact ? item.type === (isGroup ? group : type3) : isGroup ? item.type.startsWith(`${group}/`) : item.type === group;
  };
}
function createDataTransferStub(window) {
  return new class DataTransferStub {
    getData(format) {
      var _this_items_find;
      const match = (_this_items_find = this.items.find(getTypeMatcher(format, true))) !== null && _this_items_find !== void 0 ? _this_items_find : this.items.find(getTypeMatcher(format, false));
      let text = "";
      match === null || match === void 0 ? void 0 : match.getAsString((t) => {
        text = t;
      });
      return text;
    }
    setData(format, data) {
      const matchIndex = this.items.findIndex(getTypeMatcher(format, true));
      const item = new DataTransferItemStub(data, format);
      if (matchIndex >= 0) {
        this.items.splice(matchIndex, 1, item);
      } else {
        this.items.push(item);
      }
    }
    clearData(format) {
      if (format) {
        const matchIndex = this.items.findIndex(getTypeMatcher(format, true));
        if (matchIndex >= 0) {
          this.items.remove(matchIndex);
        }
      } else {
        this.items.clear();
      }
    }
    get types() {
      const t = [];
      if (this.files.length) {
        t.push("Files");
      }
      this.items.forEach((i) => t.push(i.type));
      Object.freeze(t);
      return t;
    }
    /* istanbul ignore next */
    setDragImage() {
    }
    constructor() {
      _define_property(this, "dropEffect", "none");
      _define_property(this, "effectAllowed", "uninitialized");
      _define_property(this, "items", new DataTransferItemListStub());
      _define_property(this, "files", createFileList(window, []));
    }
  }();
}
function createDataTransfer(window, files = []) {
  const dt = typeof window.DataTransfer === "undefined" ? createDataTransferStub(window) : (
    /* istanbul ignore next */
    new window.DataTransfer()
  );
  Object.defineProperty(dt, "files", {
    get: () => createFileList(window, files)
  });
  return dt;
}
async function getBlobFromDataTransferItem(window, item) {
  if (item.kind === "file") {
    return item.getAsFile();
  }
  return new window.Blob([
    await new Promise((r) => item.getAsString(r))
  ], {
    type: item.type
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/dataTransfer/Clipboard.js
function _define_property2(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function createClipboardItem(window, ...blobs) {
  const dataMap = Object.fromEntries(blobs.map((b) => [
    typeof b === "string" ? "text/plain" : b.type,
    Promise.resolve(b)
  ]));
  if (typeof window.ClipboardItem !== "undefined") {
    return new window.ClipboardItem(dataMap);
  }
  return new class ClipboardItem {
    get types() {
      return Array.from(Object.keys(this.data));
    }
    async getType(type3) {
      const value = await this.data[type3];
      if (!value) {
        throw new Error(`${type3} is not one of the available MIME types on this item.`);
      }
      return value instanceof window.Blob ? value : new window.Blob([
        value
      ], {
        type: type3
      });
    }
    constructor(d) {
      _define_property2(this, "data", void 0);
      this.data = d;
    }
  }(dataMap);
}
var ClipboardStubControl = /* @__PURE__ */ Symbol("Manage ClipboardSub");
function createClipboardStub(window, control) {
  return Object.assign(new class Clipboard extends window.EventTarget {
    async read() {
      return Array.from(this.items);
    }
    async readText() {
      let text = "";
      for (const item of this.items) {
        const type3 = item.types.includes("text/plain") ? "text/plain" : item.types.find((t) => t.startsWith("text/"));
        if (type3) {
          text += await item.getType(type3).then((b) => readBlobText(b, window.FileReader));
        }
      }
      return text;
    }
    async write(data) {
      this.items = data;
    }
    async writeText(text) {
      this.items = [
        createClipboardItem(window, text)
      ];
    }
    constructor(...args) {
      super(...args), _define_property2(this, "items", []);
    }
  }(), {
    [ClipboardStubControl]: control
  });
}
function isClipboardStub(clipboard) {
  return !!(clipboard === null || clipboard === void 0 ? void 0 : clipboard[ClipboardStubControl]);
}
function attachClipboardStubToView(window) {
  if (isClipboardStub(window.navigator.clipboard)) {
    return window.navigator.clipboard[ClipboardStubControl];
  }
  const realClipboard = Object.getOwnPropertyDescriptor(window.navigator, "clipboard");
  let stub;
  const control = {
    resetClipboardStub: () => {
      stub = createClipboardStub(window, control);
    },
    detachClipboardStub: () => {
      if (realClipboard) {
        Object.defineProperty(window.navigator, "clipboard", realClipboard);
      } else {
        Object.defineProperty(window.navigator, "clipboard", {
          value: void 0,
          configurable: true
        });
      }
    }
  };
  stub = createClipboardStub(window, control);
  Object.defineProperty(window.navigator, "clipboard", {
    get: () => stub,
    configurable: true
  });
  return stub[ClipboardStubControl];
}
function resetClipboardStubOnView(window) {
  if (isClipboardStub(window.navigator.clipboard)) {
    window.navigator.clipboard[ClipboardStubControl].resetClipboardStub();
  }
}
function detachClipboardStubFromView(window) {
  if (isClipboardStub(window.navigator.clipboard)) {
    window.navigator.clipboard[ClipboardStubControl].detachClipboardStub();
  }
}
async function readDataTransferFromClipboard(document) {
  const window = document.defaultView;
  const clipboard = window === null || window === void 0 ? void 0 : window.navigator.clipboard;
  const items = clipboard && await clipboard.read();
  if (!items) {
    throw new Error("The Clipboard API is unavailable.");
  }
  const dt = createDataTransfer(window);
  for (const item of items) {
    for (const type3 of item.types) {
      dt.setData(type3, await item.getType(type3).then((b) => readBlobText(b, window.FileReader)));
    }
  }
  return dt;
}
async function writeDataTransferToClipboard(document, clipboardData) {
  const window = getWindow(document);
  const clipboard = window.navigator.clipboard;
  const items = [];
  for (let i = 0; i < clipboardData.items.length; i++) {
    const dtItem = clipboardData.items[i];
    const blob = await getBlobFromDataTransferItem(window, dtItem);
    items.push(createClipboardItem(window, blob));
  }
  const written = clipboard && await clipboard.write(items).then(
    () => true,
    // Can happen with other implementations that e.g. require permissions
    /* istanbul ignore next */
    () => false
  );
  if (!written) {
    throw new Error("The Clipboard API is unavailable.");
  }
}
var g = globalThis;
if (typeof g.afterEach === "function") {
  g.afterEach(() => resetClipboardStubOnView(globalThis.window));
}
if (typeof g.afterAll === "function") {
  g.afterAll(() => detachClipboardStubFromView(globalThis.window));
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/focus/selector.js
var FOCUSABLE_SELECTOR = [
  "input:not([type=hidden]):not([disabled])",
  "button:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  "a[href]",
  "[tabindex]:not([disabled])"
].join(", ");

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/focus/isFocusable.js
function isFocusable(element) {
  return element.matches(FOCUSABLE_SELECTOR);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/cloneEvent.js
function cloneEvent(event) {
  return new event.constructor(event.type, event);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/isDisabled.js
function isDisabled(element) {
  for (let el = element; el; el = el.parentElement) {
    if (isElementType(el, [
      "button",
      "input",
      "select",
      "textarea",
      "optgroup",
      "option"
    ])) {
      if (el.hasAttribute("disabled")) {
        return true;
      }
    } else if (isElementType(el, "fieldset")) {
      var _el_querySelector;
      if (el.hasAttribute("disabled") && !((_el_querySelector = el.querySelector(":scope > legend")) === null || _el_querySelector === void 0 ? void 0 : _el_querySelector.contains(element))) {
        return true;
      }
    } else if (el.tagName.includes("-")) {
      if (el.constructor.formAssociated && el.hasAttribute("disabled")) {
        return true;
      }
    }
  }
  return false;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/focus/getActiveElement.js
function getActiveElement(document) {
  const activeElement = document.activeElement;
  if (activeElement === null || activeElement === void 0 ? void 0 : activeElement.shadowRoot) {
    return getActiveElement(activeElement.shadowRoot);
  } else {
    if (isDisabled(activeElement)) {
      return document.ownerDocument ? (
        /* istanbul ignore next */
        document.ownerDocument.body
      ) : document.body;
    }
    return activeElement;
  }
}
function getActiveElementOrBody(document) {
  var _getActiveElement;
  return (_getActiveElement = getActiveElement(document)) !== null && _getActiveElement !== void 0 ? _getActiveElement : (
    /* istanbul ignore next */
    document.body
  );
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/findClosest.js
function findClosest(element, callback) {
  let el = element;
  do {
    if (callback(el)) {
      return el;
    }
    el = el.parentElement;
  } while (el && el !== element.ownerDocument.body);
  return void 0;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/edit/isContentEditable.js
function isContentEditable(element) {
  return element.hasAttribute("contenteditable") && (element.getAttribute("contenteditable") == "true" || element.getAttribute("contenteditable") == "");
}
function getContentEditable(node) {
  const element = getElement(node);
  return element && (element.closest('[contenteditable=""]') || element.closest('[contenteditable="true"]'));
}
function getElement(node) {
  return node.nodeType === 1 ? node : node.parentElement;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/click/isClickableInput.js
var clickableInputTypes = (function(clickableInputTypes2) {
  clickableInputTypes2["button"] = "button";
  clickableInputTypes2["color"] = "color";
  clickableInputTypes2["file"] = "file";
  clickableInputTypes2["image"] = "image";
  clickableInputTypes2["reset"] = "reset";
  clickableInputTypes2["submit"] = "submit";
  clickableInputTypes2["checkbox"] = "checkbox";
  clickableInputTypes2["radio"] = "radio";
  return clickableInputTypes2;
})(clickableInputTypes || {});
function isClickableInput(element) {
  return isElementType(element, "button") || isElementType(element, "input") && element.type in clickableInputTypes;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/edit/isEditable.js
function isEditable(element) {
  return isEditableInputOrTextArea(element) && !element.readOnly || isContentEditable(element);
}
var editableInputTypes = (function(editableInputTypes2) {
  editableInputTypes2["text"] = "text";
  editableInputTypes2["date"] = "date";
  editableInputTypes2["datetime-local"] = "datetime-local";
  editableInputTypes2["email"] = "email";
  editableInputTypes2["month"] = "month";
  editableInputTypes2["number"] = "number";
  editableInputTypes2["password"] = "password";
  editableInputTypes2["search"] = "search";
  editableInputTypes2["tel"] = "tel";
  editableInputTypes2["time"] = "time";
  editableInputTypes2["url"] = "url";
  editableInputTypes2["week"] = "week";
  return editableInputTypes2;
})(editableInputTypes || {});
function isEditableInputOrTextArea(element) {
  return isElementType(element, "textarea") || isElementType(element, "input") && element.type in editableInputTypes;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/focus/selection.js
function hasOwnSelection(node) {
  return isElement(node) && isEditableInputOrTextArea(node);
}
function hasNoSelection(node) {
  return isElement(node) && isClickableInput(node);
}
function isElement(node) {
  return node.nodeType === 1;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/updateSelectionOnFocus.js
function updateSelectionOnFocus(element) {
  const selection = element.ownerDocument.getSelection();
  if (!(selection === null || selection === void 0 ? void 0 : selection.focusNode)) {
    return;
  }
  if (hasOwnSelection(element)) {
    const contenteditable = getContentEditable(selection.focusNode);
    if (contenteditable) {
      if (!selection.isCollapsed) {
        var _contenteditable_firstChild;
        const focusNode = ((_contenteditable_firstChild = contenteditable.firstChild) === null || _contenteditable_firstChild === void 0 ? void 0 : _contenteditable_firstChild.nodeType) === 3 ? contenteditable.firstChild : contenteditable;
        selection.setBaseAndExtent(focusNode, 0, focusNode, 0);
      }
    } else {
      selection.setBaseAndExtent(element, 0, element, 0);
    }
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/wrapEvent.js
function wrapEvent(cb, _element) {
  return getConfig().eventWrapper(cb);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/focus.js
function focusElement(element) {
  const target = findClosest(element, isFocusable);
  const activeElement = getActiveElement(element.ownerDocument);
  if ((target !== null && target !== void 0 ? target : element.ownerDocument.body) === activeElement) {
    return;
  } else if (target) {
    wrapEvent(() => target.focus());
  } else {
    wrapEvent(() => activeElement === null || activeElement === void 0 ? void 0 : activeElement.blur());
  }
  updateSelectionOnFocus(target !== null && target !== void 0 ? target : element.ownerDocument.body);
}
function blurElement(element) {
  if (!isFocusable(element)) return;
  const wasActive = getActiveElement(element.ownerDocument) === element;
  if (!wasActive) return;
  wrapEvent(() => element.blur());
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/registry.js
var behavior = {};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/click.js
behavior.click = (event, target, instance) => {
  const context = target.closest("button,input,label,select,textarea");
  const control = context && isElementType(context, "label") && context.control;
  if (control && control !== target) {
    return () => {
      if (isFocusable(control)) {
        focusElement(control);
        instance.dispatchEvent(control, cloneEvent(event));
      }
    };
  } else if (isElementType(target, "input", {
    type: "file"
  })) {
    return () => {
      blurElement(target);
      target.dispatchEvent(new (getWindow(target)).Event("fileDialog"));
      focusElement(target);
    };
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/UI.js
var UIValue = /* @__PURE__ */ Symbol("Displayed value in UI");
var UISelection = /* @__PURE__ */ Symbol("Displayed selection in UI");
var InitialValue = /* @__PURE__ */ Symbol("Initial value to compare on blur");
function isUIValue(value) {
  return typeof value === "object" && UIValue in value;
}
function isUISelectionStart(start) {
  return !!start && typeof start === "object" && UISelection in start;
}
function setUIValue(element, value) {
  if (element[InitialValue] === void 0) {
    element[InitialValue] = element.value;
  }
  element[UIValue] = value;
  element.value = Object.assign(new String(value), {
    [UIValue]: true
  });
}
function getUIValue(element) {
  return element[UIValue] === void 0 ? element.value : String(element[UIValue]);
}
function setUIValueClean(element) {
  element[UIValue] = void 0;
}
function clearInitialValue(element) {
  element[InitialValue] = void 0;
}
function getInitialValue(element) {
  return element[InitialValue];
}
function setUISelectionRaw(element, selection) {
  element[UISelection] = selection;
}
function setUISelection(element, { focusOffset: focusOffsetParam, anchorOffset: anchorOffsetParam = focusOffsetParam }, mode = "replace") {
  const valueLength = getUIValue(element).length;
  const sanitizeOffset = (o) => Math.max(0, Math.min(valueLength, o));
  const anchorOffset = mode === "replace" || element[UISelection] === void 0 ? sanitizeOffset(anchorOffsetParam) : element[UISelection].anchorOffset;
  const focusOffset = sanitizeOffset(focusOffsetParam);
  const startOffset = Math.min(anchorOffset, focusOffset);
  const endOffset = Math.max(anchorOffset, focusOffset);
  element[UISelection] = {
    anchorOffset,
    focusOffset
  };
  if (element.selectionStart === startOffset && element.selectionEnd === endOffset) {
    return;
  }
  const startObj = Object.assign(new Number(startOffset), {
    [UISelection]: true
  });
  try {
    element.setSelectionRange(startObj, endOffset);
  } catch {
  }
}
function getUISelection(element) {
  var _element_selectionStart, _element_selectionEnd, _element_UISelection;
  const sel = (_element_UISelection = element[UISelection]) !== null && _element_UISelection !== void 0 ? _element_UISelection : {
    anchorOffset: (_element_selectionStart = element.selectionStart) !== null && _element_selectionStart !== void 0 ? _element_selectionStart : 0,
    focusOffset: (_element_selectionEnd = element.selectionEnd) !== null && _element_selectionEnd !== void 0 ? _element_selectionEnd : 0
  };
  return {
    ...sel,
    startOffset: Math.min(sel.anchorOffset, sel.focusOffset),
    endOffset: Math.max(sel.anchorOffset, sel.focusOffset)
  };
}
function hasUISelection(element) {
  return !!element[UISelection];
}
function setUISelectionClean(element) {
  element[UISelection] = void 0;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/edit/timeValue.js
var parseInt = globalThis.parseInt;
function buildTimeValue(value) {
  const onlyDigitsValue = value.replace(/\D/g, "");
  if (onlyDigitsValue.length < 2) {
    return value;
  }
  const firstDigit = parseInt(onlyDigitsValue[0], 10);
  const secondDigit = parseInt(onlyDigitsValue[1], 10);
  if (firstDigit >= 3 || firstDigit === 2 && secondDigit >= 4) {
    let index;
    if (firstDigit >= 3) {
      index = 1;
    } else {
      index = 2;
    }
    return build(onlyDigitsValue, index);
  }
  if (value.length === 2) {
    return value;
  }
  return build(onlyDigitsValue, 2);
}
function build(onlyDigitsValue, index) {
  const hours = onlyDigitsValue.slice(0, index);
  const validHours = Math.min(parseInt(hours, 10), 23);
  const minuteCharacters = onlyDigitsValue.slice(index);
  const parsedMinutes = parseInt(minuteCharacters, 10);
  const validMinutes = Math.min(parsedMinutes, 59);
  return `${validHours.toString().padStart(2, "0")}:${validMinutes.toString().padStart(2, "0")}`;
}
function isValidDateOrTimeValue(element, value) {
  const clone = element.cloneNode();
  clone.value = value;
  return clone.value === value;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/edit/maxLength.js
var maxLengthSupportedTypes = (function(maxLengthSupportedTypes2) {
  maxLengthSupportedTypes2["email"] = "email";
  maxLengthSupportedTypes2["password"] = "password";
  maxLengthSupportedTypes2["search"] = "search";
  maxLengthSupportedTypes2["telephone"] = "telephone";
  maxLengthSupportedTypes2["text"] = "text";
  maxLengthSupportedTypes2["url"] = "url";
  return maxLengthSupportedTypes2;
})(maxLengthSupportedTypes || {});
function getMaxLength(element) {
  var _element_getAttribute;
  const attr = (_element_getAttribute = element.getAttribute("maxlength")) !== null && _element_getAttribute !== void 0 ? _element_getAttribute : "";
  return /^\d+$/.test(attr) && Number(attr) >= 0 ? Number(attr) : void 0;
}
function supportsMaxLength(element) {
  return isElementType(element, "textarea") || isElementType(element, "input") && element.type in maxLengthSupportedTypes;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/focus/cursor.js
function getNextCursorPosition(node, offset, direction, inputType) {
  if (isTextNode(node) && offset + direction >= 0 && offset + direction <= node.nodeValue.length) {
    return {
      node,
      offset: offset + direction
    };
  }
  const nextNode = getNextCharacterContentNode(node, offset, direction);
  if (nextNode) {
    if (isTextNode(nextNode)) {
      return {
        node: nextNode,
        offset: direction > 0 ? Math.min(1, nextNode.nodeValue.length) : Math.max(nextNode.nodeValue.length - 1, 0)
      };
    } else if (isElementType(nextNode, "br")) {
      const nextPlusOne = getNextCharacterContentNode(nextNode, void 0, direction);
      if (!nextPlusOne) {
        if (direction < 0 && inputType === "deleteContentBackward") {
          return {
            node: nextNode.parentNode,
            offset: getOffset(nextNode)
          };
        }
        return void 0;
      } else if (isTextNode(nextPlusOne)) {
        return {
          node: nextPlusOne,
          offset: direction > 0 ? 0 : nextPlusOne.nodeValue.length
        };
      } else if (direction < 0 && isElementType(nextPlusOne, "br")) {
        return {
          node: nextNode.parentNode,
          offset: getOffset(nextNode)
        };
      } else {
        return {
          node: nextPlusOne.parentNode,
          offset: getOffset(nextPlusOne) + (direction > 0 ? 0 : 1)
        };
      }
    } else {
      return {
        node: nextNode.parentNode,
        offset: getOffset(nextNode) + (direction > 0 ? 1 : 0)
      };
    }
  }
}
function getNextCharacterContentNode(node, offset, direction) {
  const nextOffset = Number(offset) + (direction < 0 ? -1 : 0);
  if (offset !== void 0 && isElement2(node) && nextOffset >= 0 && nextOffset < node.children.length) {
    node = node.children[nextOffset];
  }
  return walkNodes(node, direction === 1 ? "next" : "previous", isTreatedAsCharacterContent);
}
function isTreatedAsCharacterContent(node) {
  if (isTextNode(node)) {
    return true;
  }
  if (isElement2(node)) {
    if (isElementType(node, [
      "input",
      "textarea"
    ])) {
      return node.type !== "hidden";
    } else if (isElementType(node, "br")) {
      return true;
    }
  }
  return false;
}
function getOffset(node) {
  let i = 0;
  while (node.previousSibling) {
    i++;
    node = node.previousSibling;
  }
  return i;
}
function isElement2(node) {
  return node.nodeType === 1;
}
function isTextNode(node) {
  return node.nodeType === 3;
}
function walkNodes(node, direction, callback) {
  for (; ; ) {
    var _node_ownerDocument;
    const sibling = node[`${direction}Sibling`];
    if (sibling) {
      node = getDescendant(sibling, direction === "next" ? "first" : "last");
      if (callback(node)) {
        return node;
      }
    } else if (node.parentNode && (!isElement2(node.parentNode) || !isContentEditable(node.parentNode) && node.parentNode !== ((_node_ownerDocument = node.ownerDocument) === null || _node_ownerDocument === void 0 ? void 0 : _node_ownerDocument.body))) {
      node = node.parentNode;
    } else {
      break;
    }
  }
}
function getDescendant(node, direction) {
  while (node.hasChildNodes()) {
    node = node[`${direction}Child`];
  }
  return node;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/trackValue.js
var TrackChanges = /* @__PURE__ */ Symbol("Track programmatic changes for React workaround");
function isReact17Element(element) {
  return Object.getOwnPropertyNames(element).some((k) => k.startsWith("__react")) && getWindow(element).REACT_VERSION === 17;
}
function startTrackValue(element) {
  if (!isReact17Element(element)) {
    return;
  }
  element[TrackChanges] = {
    previousValue: String(element.value),
    tracked: []
  };
}
function trackOrSetValue(element, v) {
  var _element_TrackChanges_tracked, _element_TrackChanges;
  (_element_TrackChanges = element[TrackChanges]) === null || _element_TrackChanges === void 0 ? void 0 : (_element_TrackChanges_tracked = _element_TrackChanges.tracked) === null || _element_TrackChanges_tracked === void 0 ? void 0 : _element_TrackChanges_tracked.push(v);
  if (!element[TrackChanges]) {
    setUIValueClean(element);
    setUISelection(element, {
      focusOffset: v.length
    });
  }
}
function commitValueAfterInput(element, cursorOffset) {
  var _changes_tracked;
  const changes = element[TrackChanges];
  element[TrackChanges] = void 0;
  if (!(changes === null || changes === void 0 ? void 0 : (_changes_tracked = changes.tracked) === null || _changes_tracked === void 0 ? void 0 : _changes_tracked.length)) {
    return;
  }
  const isJustReactStateUpdate = changes.tracked.length === 2 && changes.tracked[0] === changes.previousValue && changes.tracked[1] === element.value;
  if (!isJustReactStateUpdate) {
    setUIValueClean(element);
  }
  if (hasUISelection(element)) {
    setUISelection(element, {
      focusOffset: isJustReactStateUpdate ? cursorOffset : element.value.length
    });
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/getTargetTypeAndSelection.js
function getTargetTypeAndSelection(node) {
  const element = getElement2(node);
  if (element && hasOwnSelection(element)) {
    return {
      type: "input",
      selection: getUISelection(element)
    };
  }
  const selection = element === null || element === void 0 ? void 0 : element.ownerDocument.getSelection();
  const isCE = getContentEditable(node) && (selection === null || selection === void 0 ? void 0 : selection.anchorNode) && getContentEditable(selection.anchorNode);
  return {
    type: isCE ? "contenteditable" : "default",
    selection
  };
}
function getElement2(node) {
  return node.nodeType === 1 ? node : node.parentElement;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/getInputRange.js
function getInputRange(focusNode) {
  const typeAndSelection = getTargetTypeAndSelection(focusNode);
  if (typeAndSelection.type === "input") {
    return typeAndSelection.selection;
  } else if (typeAndSelection.type === "contenteditable") {
    var _typeAndSelection_selection;
    return (_typeAndSelection_selection = typeAndSelection.selection) === null || _typeAndSelection_selection === void 0 ? void 0 : _typeAndSelection_selection.getRangeAt(0);
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/setSelection.js
function setSelection({ focusNode, focusOffset, anchorNode = focusNode, anchorOffset = focusOffset }) {
  var _anchorNode_ownerDocument_getSelection, _anchorNode_ownerDocument;
  const typeAndSelection = getTargetTypeAndSelection(focusNode);
  if (typeAndSelection.type === "input") {
    return setUISelection(focusNode, {
      anchorOffset,
      focusOffset
    });
  }
  (_anchorNode_ownerDocument = anchorNode.ownerDocument) === null || _anchorNode_ownerDocument === void 0 ? void 0 : (_anchorNode_ownerDocument_getSelection = _anchorNode_ownerDocument.getSelection()) === null || _anchorNode_ownerDocument_getSelection === void 0 ? void 0 : _anchorNode_ownerDocument_getSelection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/input.js
function isDateOrTime(element) {
  return isElementType(element, "input") && [
    "date",
    "time"
  ].includes(element.type);
}
function input(instance, element, data, inputType = "insertText") {
  const inputRange = getInputRange(element);
  if (!inputRange) {
    return;
  }
  if (!isDateOrTime(element)) {
    const unprevented = instance.dispatchUIEvent(element, "beforeinput", {
      inputType,
      data
    });
    if (!unprevented) {
      return;
    }
  }
  if ("startContainer" in inputRange) {
    editContenteditable(instance, element, inputRange, data, inputType);
  } else {
    editInputElement(instance, element, inputRange, data, inputType);
  }
}
function editContenteditable(instance, element, inputRange, data, inputType) {
  let del = false;
  if (!inputRange.collapsed) {
    del = true;
    inputRange.deleteContents();
  } else if ([
    "deleteContentBackward",
    "deleteContentForward"
  ].includes(inputType)) {
    const nextPosition = getNextCursorPosition(inputRange.startContainer, inputRange.startOffset, inputType === "deleteContentBackward" ? -1 : 1, inputType);
    if (nextPosition) {
      del = true;
      const delRange = inputRange.cloneRange();
      if (delRange.comparePoint(nextPosition.node, nextPosition.offset) < 0) {
        delRange.setStart(nextPosition.node, nextPosition.offset);
      } else {
        delRange.setEnd(nextPosition.node, nextPosition.offset);
      }
      delRange.deleteContents();
    }
  }
  if (data) {
    if (inputRange.endContainer.nodeType === 3) {
      const offset = inputRange.endOffset;
      inputRange.endContainer.insertData(offset, data);
      inputRange.setStart(inputRange.endContainer, offset + data.length);
      inputRange.setEnd(inputRange.endContainer, offset + data.length);
    } else {
      const text = element.ownerDocument.createTextNode(data);
      inputRange.insertNode(text);
      inputRange.setStart(text, data.length);
      inputRange.setEnd(text, data.length);
    }
  }
  if (del || data) {
    instance.dispatchUIEvent(element, "input", {
      inputType
    });
  }
}
function editInputElement(instance, element, inputRange, data, inputType) {
  let dataToInsert = data;
  if (supportsMaxLength(element)) {
    const maxLength = getMaxLength(element);
    if (maxLength !== void 0 && data.length > 0) {
      const spaceUntilMaxLength = maxLength - element.value.length;
      if (spaceUntilMaxLength > 0) {
        dataToInsert = data.substring(0, spaceUntilMaxLength);
      } else {
        return;
      }
    }
  }
  const { newValue, newOffset, oldValue } = calculateNewValue(dataToInsert, element, inputRange, inputType);
  if (newValue === oldValue && newOffset === inputRange.startOffset && newOffset === inputRange.endOffset) {
    return;
  }
  if (isElementType(element, "input", {
    type: "number"
  }) && !isValidNumberInput(newValue)) {
    return;
  }
  setUIValue(element, newValue);
  setSelection({
    focusNode: element,
    anchorOffset: newOffset,
    focusOffset: newOffset
  });
  if (isDateOrTime(element)) {
    if (isValidDateOrTimeValue(element, newValue)) {
      commitInput(instance, element, newOffset, {});
      instance.dispatchUIEvent(element, "change");
      clearInitialValue(element);
    }
  } else {
    commitInput(instance, element, newOffset, {
      data,
      inputType
    });
  }
}
function calculateNewValue(inputData, node, { startOffset, endOffset }, inputType) {
  const value = getUIValue(node);
  const prologEnd = Math.max(0, startOffset === endOffset && inputType === "deleteContentBackward" ? startOffset - 1 : startOffset);
  const prolog = value.substring(0, prologEnd);
  const epilogStart = Math.min(value.length, startOffset === endOffset && inputType === "deleteContentForward" ? startOffset + 1 : endOffset);
  const epilog = value.substring(epilogStart, value.length);
  let newValue = `${prolog}${inputData}${epilog}`;
  let newOffset = prologEnd + inputData.length;
  if (isElementType(node, "input", {
    type: "time"
  })) {
    const builtValue = buildTimeValue(newValue);
    if (builtValue !== "" && isValidDateOrTimeValue(node, builtValue)) {
      newValue = builtValue;
      newOffset = builtValue.length;
    }
  }
  return {
    oldValue: value,
    newValue,
    newOffset
  };
}
function commitInput(instance, element, newOffset, inputInit) {
  instance.dispatchUIEvent(element, "input", inputInit);
  commitValueAfterInput(element, newOffset);
}
function isValidNumberInput(value) {
  var _value_match, _value_match1;
  const valueParts = value.split("e", 2);
  return !(/[^\d.\-e]/.test(value) || Number((_value_match = value.match(/-/g)) === null || _value_match === void 0 ? void 0 : _value_match.length) > 2 || Number((_value_match1 = value.match(/\./g)) === null || _value_match1 === void 0 ? void 0 : _value_match1.length) > 1 || valueParts[1] && !/^-?\d*$/.test(valueParts[1]));
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/cut.js
behavior.cut = (event, target, instance) => {
  return () => {
    if (isEditable(target)) {
      input(instance, target, "", "deleteByCut");
    }
  };
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/getValueOrTextContent.js
function getValueOrTextContent(element) {
  if (!element) {
    return null;
  }
  if (isContentEditable(element)) {
    return element.textContent;
  }
  return getUIValue(element);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/isVisible.js
function isVisible(element) {
  const window = getWindow(element);
  for (let el = element; el === null || el === void 0 ? void 0 : el.ownerDocument; el = el.parentElement) {
    const { display, visibility } = window.getComputedStyle(el);
    if (display === "none") {
      return false;
    }
    if (visibility === "hidden") {
      return false;
    }
  }
  return true;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/focus/getTabDestination.js
function getTabDestination(activeElement, shift) {
  const document = activeElement.ownerDocument;
  const focusableElements = document.querySelectorAll(FOCUSABLE_SELECTOR);
  const enabledElements = Array.from(focusableElements).filter((el) => el === activeElement || !(Number(el.getAttribute("tabindex")) < 0 || isDisabled(el)));
  if (Number(activeElement.getAttribute("tabindex")) >= 0) {
    enabledElements.sort((a, b) => {
      const i = Number(a.getAttribute("tabindex"));
      const j = Number(b.getAttribute("tabindex"));
      if (i === j) {
        return 0;
      } else if (i === 0) {
        return 1;
      } else if (j === 0) {
        return -1;
      }
      return i - j;
    });
  }
  const checkedRadio = {};
  let prunedElements = [
    document.body
  ];
  const activeRadioGroup = isElementType(activeElement, "input", {
    type: "radio"
  }) ? activeElement.name : void 0;
  enabledElements.forEach((currentElement) => {
    const el = currentElement;
    if (isElementType(el, "input", {
      type: "radio"
    }) && el.name) {
      if (el === activeElement) {
        prunedElements.push(el);
        return;
      } else if (el.name === activeRadioGroup) {
        return;
      }
      if (el.checked) {
        prunedElements = prunedElements.filter((e) => !isElementType(e, "input", {
          type: "radio",
          name: el.name
        }));
        prunedElements.push(el);
        checkedRadio[el.name] = el;
        return;
      }
      if (typeof checkedRadio[el.name] !== "undefined") {
        return;
      }
    }
    prunedElements.push(el);
  });
  for (let index = prunedElements.findIndex((el) => el === activeElement); ; ) {
    index += shift ? -1 : 1;
    if (index === prunedElements.length) {
      index = 0;
    } else if (index === -1) {
      index = prunedElements.length - 1;
    }
    if (prunedElements[index] === activeElement || prunedElements[index] === document.body || isVisible(prunedElements[index])) {
      return prunedElements[index];
    }
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/moveSelection.js
function moveSelection(node, direction) {
  if (hasOwnSelection(node)) {
    const selection = getUISelection(node);
    setSelection({
      focusNode: node,
      focusOffset: selection.startOffset === selection.endOffset ? selection.focusOffset + direction : direction < 0 ? selection.startOffset : selection.endOffset
    });
  } else {
    const selection = node.ownerDocument.getSelection();
    if (!(selection === null || selection === void 0 ? void 0 : selection.focusNode)) {
      return;
    }
    if (selection.isCollapsed) {
      const nextPosition = getNextCursorPosition(selection.focusNode, selection.focusOffset, direction);
      if (nextPosition) {
        setSelection({
          focusNode: nextPosition.node,
          focusOffset: nextPosition.offset
        });
      }
    } else {
      selection[direction < 0 ? "collapseToStart" : "collapseToEnd"]();
    }
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/selectAll.js
function selectAll(target) {
  if (hasOwnSelection(target)) {
    return setSelection({
      focusNode: target,
      anchorOffset: 0,
      focusOffset: getUIValue(target).length
    });
  }
  var _getContentEditable;
  const focusNode = (_getContentEditable = getContentEditable(target)) !== null && _getContentEditable !== void 0 ? _getContentEditable : target.ownerDocument.body;
  setSelection({
    focusNode,
    anchorOffset: 0,
    focusOffset: focusNode.childNodes.length
  });
}
function isAllSelected(target) {
  if (hasOwnSelection(target)) {
    return getUISelection(target).startOffset === 0 && getUISelection(target).endOffset === getUIValue(target).length;
  }
  var _getContentEditable;
  const focusNode = (_getContentEditable = getContentEditable(target)) !== null && _getContentEditable !== void 0 ? _getContentEditable : target.ownerDocument.body;
  const selection = target.ownerDocument.getSelection();
  return (selection === null || selection === void 0 ? void 0 : selection.anchorNode) === focusNode && selection.focusNode === focusNode && selection.anchorOffset === 0 && selection.focusOffset === focusNode.childNodes.length;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/setSelectionRange.js
function setSelectionRange(element, anchorOffset, focusOffset) {
  var _element_firstChild;
  if (hasOwnSelection(element)) {
    return setSelection({
      focusNode: element,
      anchorOffset,
      focusOffset
    });
  }
  if (isContentEditable(element) && ((_element_firstChild = element.firstChild) === null || _element_firstChild === void 0 ? void 0 : _element_firstChild.nodeType) === 3) {
    return setSelection({
      focusNode: element.firstChild,
      anchorOffset,
      focusOffset
    });
  }
  throw new Error("Not implemented. The result of this interaction is unreliable.");
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/radio.js
function walkRadio(instance, el, direction) {
  const window = getWindow(el);
  const group = Array.from(el.ownerDocument.querySelectorAll(el.name ? `input[type="radio"][name="${window.CSS.escape(el.name)}"]` : `input[type="radio"][name=""], input[type="radio"]:not([name])`));
  for (let i = group.findIndex((e) => e === el) + direction; ; i += direction) {
    if (!group[i]) {
      i = direction > 0 ? 0 : group.length - 1;
    }
    if (group[i] === el) {
      return;
    }
    if (isDisabled(group[i])) {
      continue;
    }
    focusElement(group[i]);
    instance.dispatchUIEvent(group[i], "click");
    return;
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/keydown.js
behavior.keydown = (event, target, instance) => {
  var _keydownBehavior_event_key;
  var _keydownBehavior_event_key1;
  return (_keydownBehavior_event_key1 = (_keydownBehavior_event_key = keydownBehavior[event.key]) === null || _keydownBehavior_event_key === void 0 ? void 0 : _keydownBehavior_event_key.call(keydownBehavior, event, target, instance)) !== null && _keydownBehavior_event_key1 !== void 0 ? _keydownBehavior_event_key1 : combinationBehavior(event, target, instance);
};
var keydownBehavior = {
  ArrowDown: (event, target, instance) => {
    if (isElementType(target, "input", {
      type: "radio"
    })) {
      return () => walkRadio(instance, target, 1);
    }
  },
  ArrowLeft: (event, target, instance) => {
    if (isElementType(target, "input", {
      type: "radio"
    })) {
      return () => walkRadio(instance, target, -1);
    }
    return () => moveSelection(target, -1);
  },
  ArrowRight: (event, target, instance) => {
    if (isElementType(target, "input", {
      type: "radio"
    })) {
      return () => walkRadio(instance, target, 1);
    }
    return () => moveSelection(target, 1);
  },
  ArrowUp: (event, target, instance) => {
    if (isElementType(target, "input", {
      type: "radio"
    })) {
      return () => walkRadio(instance, target, -1);
    }
  },
  Backspace: (event, target, instance) => {
    if (isEditable(target)) {
      return () => {
        input(instance, target, "", "deleteContentBackward");
      };
    }
  },
  Delete: (event, target, instance) => {
    if (isEditable(target)) {
      return () => {
        input(instance, target, "", "deleteContentForward");
      };
    }
  },
  End: (event, target) => {
    if (isElementType(target, [
      "input",
      "textarea"
    ]) || isContentEditable(target)) {
      return () => {
        var _getValueOrTextContent;
        var _getValueOrTextContent_length;
        const newPos = (_getValueOrTextContent_length = (_getValueOrTextContent = getValueOrTextContent(target)) === null || _getValueOrTextContent === void 0 ? void 0 : _getValueOrTextContent.length) !== null && _getValueOrTextContent_length !== void 0 ? _getValueOrTextContent_length : (
          /* istanbul ignore next */
          0
        );
        setSelectionRange(target, newPos, newPos);
      };
    }
  },
  Home: (event, target) => {
    if (isElementType(target, [
      "input",
      "textarea"
    ]) || isContentEditable(target)) {
      return () => {
        setSelectionRange(target, 0, 0);
      };
    }
  },
  PageDown: (event, target) => {
    if (isElementType(target, [
      "input"
    ])) {
      return () => {
        const newPos = getUIValue(target).length;
        setSelectionRange(target, newPos, newPos);
      };
    }
  },
  PageUp: (event, target) => {
    if (isElementType(target, [
      "input"
    ])) {
      return () => {
        setSelectionRange(target, 0, 0);
      };
    }
  },
  Tab: (event, target, instance) => {
    return () => {
      const dest = getTabDestination(target, instance.system.keyboard.modifiers.Shift);
      focusElement(dest);
      if (hasOwnSelection(dest)) {
        setUISelection(dest, {
          anchorOffset: 0,
          focusOffset: dest.value.length
        });
      }
    };
  }
};
var combinationBehavior = (event, target, instance) => {
  if (event.code === "KeyA" && instance.system.keyboard.modifiers.Control) {
    return () => selectAll(target);
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/keypress.js
behavior.keypress = (event, target, instance) => {
  if (event.key === "Enter") {
    if (isElementType(target, "button") || isElementType(target, "input") && ClickInputOnEnter.includes(target.type) || isElementType(target, "a") && Boolean(target.href)) {
      return () => {
        instance.dispatchUIEvent(target, "click");
      };
    } else if (isElementType(target, "input")) {
      const form = target.form;
      const submit = form === null || form === void 0 ? void 0 : form.querySelector('input[type="submit"], button:not([type]), button[type="submit"]');
      if (submit) {
        return () => instance.dispatchUIEvent(submit, "click");
      } else if (form && SubmitSingleInputOnEnter.includes(target.type) && form.querySelectorAll("input").length === 1) {
        return () => instance.dispatchUIEvent(form, "submit");
      } else {
        return;
      }
    }
  }
  if (isEditable(target)) {
    const inputType = event.key === "Enter" ? isContentEditable(target) && !instance.system.keyboard.modifiers.Shift ? "insertParagraph" : "insertLineBreak" : "insertText";
    const inputData = event.key === "Enter" ? "\n" : event.key;
    return () => input(instance, target, inputData, inputType);
  }
};
var ClickInputOnEnter = [
  "button",
  "color",
  "file",
  "image",
  "reset",
  "submit"
];
var SubmitSingleInputOnEnter = [
  "email",
  "month",
  "password",
  "search",
  "tel",
  "text",
  "url",
  "week"
];

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/keyup.js
behavior.keyup = (event, target, instance) => {
  var _keyupBehavior_event_key;
  return (_keyupBehavior_event_key = keyupBehavior[event.key]) === null || _keyupBehavior_event_key === void 0 ? void 0 : _keyupBehavior_event_key.call(keyupBehavior, event, target, instance);
};
var keyupBehavior = {
  " ": (event, target, instance) => {
    if (isClickableInput(target)) {
      return () => instance.dispatchUIEvent(target, "click");
    }
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/behavior/paste.js
behavior.paste = (event, target, instance) => {
  if (isEditable(target)) {
    return () => {
      var _event_clipboardData;
      const insertData = (_event_clipboardData = event.clipboardData) === null || _event_clipboardData === void 0 ? void 0 : _event_clipboardData.getData("text");
      if (insertData) {
        input(instance, target, insertData, "insertFromPaste");
      }
    };
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/eventMap.js
var eventMap = {
  auxclick: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  beforeinput: {
    EventType: "InputEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  blur: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: false,
      cancelable: false,
      composed: true
    }
  },
  click: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  contextmenu: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  copy: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  change: {
    EventType: "Event",
    defaultInit: {
      bubbles: true,
      cancelable: false
    }
  },
  cut: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  dblclick: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  focus: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: false,
      cancelable: false,
      composed: true
    }
  },
  focusin: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: true,
      cancelable: false,
      composed: true
    }
  },
  focusout: {
    EventType: "FocusEvent",
    defaultInit: {
      bubbles: true,
      cancelable: false,
      composed: true
    }
  },
  keydown: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  keypress: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  keyup: {
    EventType: "KeyboardEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  paste: {
    EventType: "ClipboardEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  input: {
    EventType: "InputEvent",
    defaultInit: {
      bubbles: true,
      cancelable: false,
      composed: true
    }
  },
  mousedown: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  mouseenter: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: false,
      cancelable: false,
      composed: true
    }
  },
  mouseleave: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: false,
      cancelable: false,
      composed: true
    }
  },
  mousemove: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  mouseout: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  mouseover: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  mouseup: {
    EventType: "MouseEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  pointerover: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  pointerenter: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: false,
      cancelable: false
    }
  },
  pointerdown: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  pointermove: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  pointerup: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  pointercancel: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: false,
      composed: true
    }
  },
  pointerout: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: true,
      cancelable: true,
      composed: true
    }
  },
  pointerleave: {
    EventType: "PointerEvent",
    defaultInit: {
      bubbles: false,
      cancelable: false
    }
  },
  submit: {
    EventType: "Event",
    defaultInit: {
      bubbles: true,
      cancelable: true
    }
  }
};
function getEventClass(type3) {
  return eventMap[type3].EventType;
}
var mouseEvents = [
  "MouseEvent",
  "PointerEvent"
];
function isMouseEvent(type3) {
  return mouseEvents.includes(getEventClass(type3));
}
function isKeyboardEvent(type3) {
  return getEventClass(type3) === "KeyboardEvent";
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/createEvent.js
var eventInitializer = {
  ClipboardEvent: [
    initClipboardEvent
  ],
  Event: [],
  FocusEvent: [
    initUIEvent,
    initFocusEvent
  ],
  InputEvent: [
    initUIEvent,
    initInputEvent
  ],
  MouseEvent: [
    initUIEvent,
    initUIEventModifiers,
    initMouseEvent
  ],
  PointerEvent: [
    initUIEvent,
    initUIEventModifiers,
    initMouseEvent,
    initPointerEvent
  ],
  KeyboardEvent: [
    initUIEvent,
    initUIEventModifiers,
    initKeyboardEvent
  ]
};
function createEvent(type3, target, init) {
  const window = getWindow(target);
  const { EventType, defaultInit } = eventMap[type3];
  const event = new (getEventConstructors(window))[EventType](type3, defaultInit);
  eventInitializer[EventType].forEach((f) => f(event, init !== null && init !== void 0 ? init : {}));
  return event;
}
function getEventConstructors(window) {
  var _window_Event;
  const Event = (_window_Event = window.Event) !== null && _window_Event !== void 0 ? _window_Event : class Event {
  };
  var _window_AnimationEvent;
  const AnimationEvent = (_window_AnimationEvent = window.AnimationEvent) !== null && _window_AnimationEvent !== void 0 ? _window_AnimationEvent : class AnimationEvent extends Event {
  };
  var _window_ClipboardEvent;
  const ClipboardEvent = (_window_ClipboardEvent = window.ClipboardEvent) !== null && _window_ClipboardEvent !== void 0 ? _window_ClipboardEvent : class ClipboardEvent extends Event {
  };
  var _window_PopStateEvent;
  const PopStateEvent = (_window_PopStateEvent = window.PopStateEvent) !== null && _window_PopStateEvent !== void 0 ? _window_PopStateEvent : class PopStateEvent extends Event {
  };
  var _window_ProgressEvent;
  const ProgressEvent = (_window_ProgressEvent = window.ProgressEvent) !== null && _window_ProgressEvent !== void 0 ? _window_ProgressEvent : class ProgressEvent extends Event {
  };
  var _window_TransitionEvent;
  const TransitionEvent = (_window_TransitionEvent = window.TransitionEvent) !== null && _window_TransitionEvent !== void 0 ? _window_TransitionEvent : class TransitionEvent extends Event {
  };
  var _window_UIEvent;
  const UIEvent = (_window_UIEvent = window.UIEvent) !== null && _window_UIEvent !== void 0 ? _window_UIEvent : class UIEvent extends Event {
  };
  var _window_CompositionEvent;
  const CompositionEvent = (_window_CompositionEvent = window.CompositionEvent) !== null && _window_CompositionEvent !== void 0 ? _window_CompositionEvent : class CompositionEvent extends UIEvent {
  };
  var _window_FocusEvent;
  const FocusEvent = (_window_FocusEvent = window.FocusEvent) !== null && _window_FocusEvent !== void 0 ? _window_FocusEvent : class FocusEvent extends UIEvent {
  };
  var _window_InputEvent;
  const InputEvent = (_window_InputEvent = window.InputEvent) !== null && _window_InputEvent !== void 0 ? _window_InputEvent : class InputEvent extends UIEvent {
  };
  var _window_KeyboardEvent;
  const KeyboardEvent = (_window_KeyboardEvent = window.KeyboardEvent) !== null && _window_KeyboardEvent !== void 0 ? _window_KeyboardEvent : class KeyboardEvent extends UIEvent {
  };
  var _window_MouseEvent;
  const MouseEvent = (_window_MouseEvent = window.MouseEvent) !== null && _window_MouseEvent !== void 0 ? _window_MouseEvent : class MouseEvent extends UIEvent {
  };
  var _window_DragEvent;
  const DragEvent = (_window_DragEvent = window.DragEvent) !== null && _window_DragEvent !== void 0 ? _window_DragEvent : class DragEvent extends MouseEvent {
  };
  var _window_PointerEvent;
  const PointerEvent = (_window_PointerEvent = window.PointerEvent) !== null && _window_PointerEvent !== void 0 ? _window_PointerEvent : class PointerEvent extends MouseEvent {
  };
  var _window_TouchEvent;
  const TouchEvent = (_window_TouchEvent = window.TouchEvent) !== null && _window_TouchEvent !== void 0 ? _window_TouchEvent : class TouchEvent extends UIEvent {
  };
  return {
    Event,
    AnimationEvent,
    ClipboardEvent,
    PopStateEvent,
    ProgressEvent,
    TransitionEvent,
    UIEvent,
    CompositionEvent,
    FocusEvent,
    InputEvent,
    KeyboardEvent,
    MouseEvent,
    DragEvent,
    PointerEvent,
    TouchEvent
  };
}
function assignProps(obj, props) {
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(obj, key, {
      get: () => value !== null && value !== void 0 ? value : null
    });
  }
}
function sanitizeNumber(n) {
  return Number(n !== null && n !== void 0 ? n : 0);
}
function initClipboardEvent(event, { clipboardData }) {
  assignProps(event, {
    clipboardData
  });
}
function initFocusEvent(event, { relatedTarget }) {
  assignProps(event, {
    relatedTarget
  });
}
function initInputEvent(event, { data, inputType, isComposing }) {
  assignProps(event, {
    data,
    isComposing: Boolean(isComposing),
    inputType: String(inputType)
  });
}
function initUIEvent(event, { view, detail }) {
  assignProps(event, {
    view,
    detail: sanitizeNumber(detail !== null && detail !== void 0 ? detail : 0)
  });
}
function initUIEventModifiers(event, { altKey, ctrlKey, metaKey, shiftKey, modifierAltGraph, modifierCapsLock, modifierFn, modifierFnLock, modifierNumLock, modifierScrollLock, modifierSymbol, modifierSymbolLock }) {
  assignProps(event, {
    altKey: Boolean(altKey),
    ctrlKey: Boolean(ctrlKey),
    metaKey: Boolean(metaKey),
    shiftKey: Boolean(shiftKey),
    getModifierState(k) {
      return Boolean({
        Alt: altKey,
        AltGraph: modifierAltGraph,
        CapsLock: modifierCapsLock,
        Control: ctrlKey,
        Fn: modifierFn,
        FnLock: modifierFnLock,
        Meta: metaKey,
        NumLock: modifierNumLock,
        ScrollLock: modifierScrollLock,
        Shift: shiftKey,
        Symbol: modifierSymbol,
        SymbolLock: modifierSymbolLock
      }[k]);
    }
  });
}
function initKeyboardEvent(event, { key, code, location, repeat, isComposing, charCode }) {
  assignProps(event, {
    key: String(key),
    code: String(code),
    location: sanitizeNumber(location),
    repeat: Boolean(repeat),
    isComposing: Boolean(isComposing),
    charCode
  });
}
function initMouseEvent(event, { x, y, screenX, screenY, clientX = x, clientY = y, button, buttons, relatedTarget, offsetX, offsetY, pageX, pageY }) {
  assignProps(event, {
    screenX: sanitizeNumber(screenX),
    screenY: sanitizeNumber(screenY),
    clientX: sanitizeNumber(clientX),
    x: sanitizeNumber(clientX),
    clientY: sanitizeNumber(clientY),
    y: sanitizeNumber(clientY),
    button: sanitizeNumber(button),
    buttons: sanitizeNumber(buttons),
    relatedTarget,
    offsetX: sanitizeNumber(offsetX),
    offsetY: sanitizeNumber(offsetY),
    pageX: sanitizeNumber(pageX),
    pageY: sanitizeNumber(pageY)
  });
}
function initPointerEvent(event, { pointerId, width, height, pressure, tangentialPressure, tiltX, tiltY, twist, pointerType, isPrimary }) {
  assignProps(event, {
    pointerId: sanitizeNumber(pointerId),
    width: sanitizeNumber(width !== null && width !== void 0 ? width : 1),
    height: sanitizeNumber(height !== null && height !== void 0 ? height : 1),
    pressure: sanitizeNumber(pressure),
    tangentialPressure: sanitizeNumber(tangentialPressure),
    tiltX: sanitizeNumber(tiltX),
    tiltY: sanitizeNumber(tiltY),
    twist: sanitizeNumber(twist),
    pointerType: String(pointerType),
    isPrimary: Boolean(isPrimary)
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/dispatchEvent.js
function dispatchUIEvent(target, type3, init, preventDefault = false) {
  if (isMouseEvent(type3) || isKeyboardEvent(type3)) {
    init = {
      ...init,
      ...this.system.getUIEventModifiers()
    };
  }
  const event = createEvent(type3, target, init);
  return dispatchEvent.call(this, target, event, preventDefault);
}
function dispatchEvent(target, event, preventDefault = false) {
  var _behavior_type;
  const type3 = event.type;
  const behaviorImplementation = preventDefault ? () => {
  } : (_behavior_type = behavior[type3]) === null || _behavior_type === void 0 ? void 0 : _behavior_type.call(behavior, event, target, this);
  if (behaviorImplementation) {
    event.preventDefault();
    let defaultPrevented = false;
    Object.defineProperty(event, "defaultPrevented", {
      get: () => defaultPrevented
    });
    Object.defineProperty(event, "preventDefault", {
      value: () => {
        defaultPrevented = event.cancelable;
      }
    });
    wrapEvent(() => target.dispatchEvent(event));
    if (!defaultPrevented) {
      behaviorImplementation();
    }
    return !defaultPrevented;
  }
  return wrapEvent(() => target.dispatchEvent(event));
}
function dispatchDOMEvent(target, type3, init) {
  const event = createEvent(type3, target, init);
  wrapEvent(() => target.dispatchEvent(event));
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/patchFocus.js
var patched = /* @__PURE__ */ Symbol("patched focus/blur methods");
function patchFocus(HTMLElement) {
  if (HTMLElement.prototype[patched]) {
    return;
  }
  const { focus, blur } = HTMLElement.prototype;
  Object.defineProperties(HTMLElement.prototype, {
    focus: {
      configurable: true,
      get: () => patchedFocus
    },
    blur: {
      configurable: true,
      get: () => patchedBlur
    },
    [patched]: {
      configurable: true,
      get: () => ({
        focus,
        blur
      })
    }
  });
  let activeCall;
  function patchedFocus(options) {
    if (this.ownerDocument.visibilityState !== "hidden") {
      return focus.call(this, options);
    }
    const blurred = getActiveTarget(this.ownerDocument);
    if (blurred === this) {
      return;
    }
    const thisCall = /* @__PURE__ */ Symbol("focus call");
    activeCall = thisCall;
    if (blurred) {
      blur.call(blurred);
      dispatchDOMEvent(blurred, "blur", {
        relatedTarget: this
      });
      dispatchDOMEvent(blurred, "focusout", {
        relatedTarget: activeCall === thisCall ? this : null
      });
    }
    if (activeCall === thisCall) {
      focus.call(this, options);
      dispatchDOMEvent(this, "focus", {
        relatedTarget: blurred
      });
    }
    if (activeCall === thisCall) {
      dispatchDOMEvent(this, "focusin", {
        relatedTarget: blurred
      });
    }
  }
  function patchedBlur() {
    if (this.ownerDocument.visibilityState !== "hidden") {
      return blur.call(this);
    }
    const blurred = getActiveTarget(this.ownerDocument);
    if (blurred !== this) {
      return;
    }
    const thisCall = /* @__PURE__ */ Symbol("blur call");
    activeCall = thisCall;
    blur.call(this);
    dispatchDOMEvent(blurred, "blur", {
      relatedTarget: null
    });
    dispatchDOMEvent(blurred, "focusout", {
      relatedTarget: null
    });
  }
}
function getActiveTarget(document) {
  const active = getActiveElement(document);
  return (active === null || active === void 0 ? void 0 : active.tagName) === "BODY" ? null : active;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/interceptor.js
var Interceptor = /* @__PURE__ */ Symbol("Interceptor for programmatical calls");
function prepareInterceptor(element, propName, interceptorImpl) {
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(element.constructor.prototype, propName);
  const objectDescriptor = Object.getOwnPropertyDescriptor(element, propName);
  const target = (prototypeDescriptor === null || prototypeDescriptor === void 0 ? void 0 : prototypeDescriptor.set) ? "set" : "value";
  if (typeof (prototypeDescriptor === null || prototypeDescriptor === void 0 ? void 0 : prototypeDescriptor[target]) !== "function" || prototypeDescriptor[target][Interceptor]) {
    throw new Error(`Element ${element.tagName} does not implement "${String(propName)}".`);
  }
  function intercept(...args) {
    const { applyNative = false, realArgs, then } = interceptorImpl.call(this, ...args);
    const realFunc = (!applyNative && objectDescriptor || prototypeDescriptor)[target];
    if (target === "set") {
      realFunc.call(this, realArgs);
    } else {
      realFunc.call(this, ...realArgs);
    }
    then === null || then === void 0 ? void 0 : then();
  }
  intercept[Interceptor] = Interceptor;
  Object.defineProperty(element, propName, {
    ...objectDescriptor !== null && objectDescriptor !== void 0 ? objectDescriptor : prototypeDescriptor,
    [target]: intercept
  });
}
function prepareValueInterceptor(element) {
  prepareInterceptor(element, "value", function interceptorImpl(v) {
    const isUI = isUIValue(v);
    if (isUI) {
      startTrackValue(this);
    }
    return {
      applyNative: !!isUI,
      realArgs: sanitizeValue(this, v),
      then: isUI ? void 0 : () => trackOrSetValue(this, String(v))
    };
  });
}
function sanitizeValue(element, v) {
  if (isElementType(element, "input", {
    type: "number"
  }) && String(v) !== "" && !Number.isNaN(Number(v))) {
    return String(Number(v));
  }
  return String(v);
}
function prepareSelectionInterceptor(element) {
  prepareInterceptor(element, "setSelectionRange", function interceptorImpl(start, ...others) {
    const isUI = isUISelectionStart(start);
    return {
      applyNative: !!isUI,
      realArgs: [
        Number(start),
        ...others
      ],
      then: () => isUI ? void 0 : setUISelectionClean(element)
    };
  });
  prepareInterceptor(element, "selectionStart", function interceptorImpl(v) {
    return {
      realArgs: v,
      then: () => setUISelectionClean(element)
    };
  });
  prepareInterceptor(element, "selectionEnd", function interceptorImpl(v) {
    return {
      realArgs: v,
      then: () => setUISelectionClean(element)
    };
  });
  prepareInterceptor(element, "select", function interceptorImpl() {
    return {
      realArgs: [],
      then: () => setUISelectionRaw(element, {
        anchorOffset: 0,
        focusOffset: getUIValue(element).length
      })
    };
  });
}
function prepareRangeTextInterceptor(element) {
  prepareInterceptor(element, "setRangeText", function interceptorImpl(...realArgs) {
    return {
      realArgs,
      then: () => {
        setUIValueClean(element);
        setUISelectionClean(element);
      }
    };
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/prepareDocument.js
var isPrepared = /* @__PURE__ */ Symbol("Node prepared with document state workarounds");
function prepareDocument(document) {
  if (document[isPrepared]) {
    return;
  }
  document.addEventListener("focus", (e) => {
    const el = e.target;
    prepareElement(el);
  }, {
    capture: true,
    passive: true
  });
  if (document.activeElement) {
    prepareElement(document.activeElement);
  }
  document.addEventListener("blur", (e) => {
    const el = e.target;
    const initialValue = getInitialValue(el);
    if (initialValue !== void 0) {
      if (el.value !== initialValue) {
        dispatchDOMEvent(el, "change");
      }
      clearInitialValue(el);
    }
  }, {
    capture: true,
    passive: true
  });
  document[isPrepared] = isPrepared;
}
function prepareElement(el) {
  if (el[isPrepared]) {
    return;
  }
  if (isElementType(el, [
    "input",
    "textarea"
  ])) {
    prepareValueInterceptor(el);
    prepareSelectionInterceptor(el);
    prepareRangeTextInterceptor(el);
  }
  el[isPrepared] = isPrepared;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/getDocumentFromNode.js
function getDocumentFromNode(el) {
  return isDocument2(el) ? el : el.ownerDocument;
}
function isDocument2(node) {
  return node.nodeType === 9;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/level.js
var ApiLevel = (function(ApiLevel2) {
  ApiLevel2[ApiLevel2["Trigger"] = 2] = "Trigger";
  ApiLevel2[ApiLevel2["Call"] = 1] = "Call";
  return ApiLevel2;
})({});
function setLevelRef(instance, level) {
  instance.levelRefs[level] = {};
}
function getLevelRef(instance, level) {
  return instance.levelRefs[level];
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/wait.js
function wait(config) {
  const delay = config.delay;
  if (typeof delay !== "number") {
    return;
  }
  return Promise.all([
    new Promise((resolve) => globalThis.setTimeout(() => resolve(), delay)),
    config.advanceTimers(delay)
  ]);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/options.js
var PointerEventsCheckLevel = (function(PointerEventsCheckLevel2) {
  PointerEventsCheckLevel2[PointerEventsCheckLevel2["EachTrigger"] = 4] = "EachTrigger";
  PointerEventsCheckLevel2[PointerEventsCheckLevel2["EachApiCall"] = 2] = "EachApiCall";
  PointerEventsCheckLevel2[PointerEventsCheckLevel2["EachTarget"] = 1] = "EachTarget";
  PointerEventsCheckLevel2[PointerEventsCheckLevel2["Never"] = 0] = "Never";
  return PointerEventsCheckLevel2;
})({});

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/keyboard.js
function _define_property3(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var DOM_KEY_LOCATION = (function(DOM_KEY_LOCATION2) {
  DOM_KEY_LOCATION2[DOM_KEY_LOCATION2["STANDARD"] = 0] = "STANDARD";
  DOM_KEY_LOCATION2[DOM_KEY_LOCATION2["LEFT"] = 1] = "LEFT";
  DOM_KEY_LOCATION2[DOM_KEY_LOCATION2["RIGHT"] = 2] = "RIGHT";
  DOM_KEY_LOCATION2[DOM_KEY_LOCATION2["NUMPAD"] = 3] = "NUMPAD";
  return DOM_KEY_LOCATION2;
})({});
var modifierKeys = [
  "Alt",
  "AltGraph",
  "Control",
  "Fn",
  "Meta",
  "Shift",
  "Symbol"
];
function isModifierKey(key) {
  return modifierKeys.includes(key);
}
var modifierLocks = [
  "CapsLock",
  "FnLock",
  "NumLock",
  "ScrollLock",
  "SymbolLock"
];
function isModifierLock(key) {
  return modifierLocks.includes(key);
}
var KeyboardHost = class {
  isKeyPressed(keyDef) {
    return this.pressed.has(String(keyDef.code));
  }
  getPressedKeys() {
    return this.pressed.values().map((p) => p.keyDef);
  }
  /** Press a key */
  async keydown(instance, keyDef) {
    const key = String(keyDef.key);
    const code = String(keyDef.code);
    const target = getActiveElementOrBody(instance.config.document);
    this.setKeydownTarget(target);
    this.pressed.add(code, keyDef);
    if (isModifierKey(key)) {
      this.modifiers[key] = true;
    }
    const unprevented = instance.dispatchUIEvent(target, "keydown", {
      key,
      code
    });
    if (isModifierLock(key) && !this.modifiers[key]) {
      this.modifiers[key] = true;
      this.modifierLockStart[key] = true;
    }
    if (unprevented) {
      this.pressed.setUnprevented(code);
    }
    if (unprevented && this.hasKeyPress(key)) {
      instance.dispatchUIEvent(getActiveElementOrBody(instance.config.document), "keypress", {
        key,
        code,
        charCode: keyDef.key === "Enter" ? 13 : String(keyDef.key).charCodeAt(0)
      });
    }
  }
  /** Release a key */
  async keyup(instance, keyDef) {
    const key = String(keyDef.key);
    const code = String(keyDef.code);
    const unprevented = this.pressed.isUnprevented(code);
    this.pressed.delete(code);
    if (isModifierKey(key) && !this.pressed.values().find((p) => p.keyDef.key === key)) {
      this.modifiers[key] = false;
    }
    instance.dispatchUIEvent(getActiveElementOrBody(instance.config.document), "keyup", {
      key,
      code
    }, !unprevented);
    if (isModifierLock(key) && this.modifiers[key]) {
      if (this.modifierLockStart[key]) {
        this.modifierLockStart[key] = false;
      } else {
        this.modifiers[key] = false;
      }
    }
  }
  setKeydownTarget(target) {
    if (target !== this.lastKeydownTarget) {
      this.carryChar = "";
    }
    this.lastKeydownTarget = target;
  }
  hasKeyPress(key) {
    return (key.length === 1 || key === "Enter") && !this.modifiers.Control && !this.modifiers.Alt;
  }
  constructor(system) {
    _define_property3(this, "system", void 0);
    _define_property3(this, "modifiers", {
      Alt: false,
      AltGraph: false,
      CapsLock: false,
      Control: false,
      Fn: false,
      FnLock: false,
      Meta: false,
      NumLock: false,
      ScrollLock: false,
      Shift: false,
      Symbol: false,
      SymbolLock: false
    });
    _define_property3(this, "pressed", new class {
      add(code, keyDef) {
        var _this_registry, _code;
        var _;
        (_ = (_this_registry = this.registry)[_code = code]) !== null && _ !== void 0 ? _ : _this_registry[_code] = {
          keyDef,
          unpreventedDefault: false
        };
      }
      has(code) {
        return !!this.registry[code];
      }
      setUnprevented(code) {
        const o = this.registry[code];
        if (o) {
          o.unpreventedDefault = true;
        }
      }
      isUnprevented(code) {
        var _this_registry_code;
        return !!((_this_registry_code = this.registry[code]) === null || _this_registry_code === void 0 ? void 0 : _this_registry_code.unpreventedDefault);
      }
      delete(code) {
        delete this.registry[code];
      }
      values() {
        return Object.values(this.registry);
      }
      constructor() {
        _define_property3(this, "registry", {});
      }
    }());
    _define_property3(this, "carryChar", "");
    _define_property3(this, "lastKeydownTarget", void 0);
    _define_property3(this, "modifierLockStart", {});
    this.system = system;
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/keyboard/keyMap.js
var defaultKeyMap = [
  // alphanumeric block - writing system
  ..."0123456789".split("").map((c) => ({
    code: `Digit${c}`,
    key: c
  })),
  ...")!@#$%^&*(".split("").map((c, i) => ({
    code: `Digit${i}`,
    key: c,
    shiftKey: true
  })),
  ..."abcdefghijklmnopqrstuvwxyz".split("").map((c) => ({
    code: `Key${c.toUpperCase()}`,
    key: c
  })),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => ({
    code: `Key${c}`,
    key: c,
    shiftKey: true
  })),
  {
    code: "BracketLeft",
    key: "["
  },
  {
    code: "BracketLeft",
    key: "{",
    shiftKey: true
  },
  {
    code: "BracketRight",
    key: "]"
  },
  {
    code: "BracketRight",
    key: "}",
    shiftKey: true
  },
  // alphanumeric block - functional
  {
    code: "Space",
    key: " "
  },
  {
    code: "AltLeft",
    key: "Alt",
    location: DOM_KEY_LOCATION.LEFT
  },
  {
    code: "AltRight",
    key: "Alt",
    location: DOM_KEY_LOCATION.RIGHT
  },
  {
    code: "ShiftLeft",
    key: "Shift",
    location: DOM_KEY_LOCATION.LEFT
  },
  {
    code: "ShiftRight",
    key: "Shift",
    location: DOM_KEY_LOCATION.RIGHT
  },
  {
    code: "ControlLeft",
    key: "Control",
    location: DOM_KEY_LOCATION.LEFT
  },
  {
    code: "ControlRight",
    key: "Control",
    location: DOM_KEY_LOCATION.RIGHT
  },
  {
    code: "MetaLeft",
    key: "Meta",
    location: DOM_KEY_LOCATION.LEFT
  },
  {
    code: "MetaRight",
    key: "Meta",
    location: DOM_KEY_LOCATION.RIGHT
  },
  {
    code: "OSLeft",
    key: "OS",
    location: DOM_KEY_LOCATION.LEFT
  },
  {
    code: "OSRight",
    key: "OS",
    location: DOM_KEY_LOCATION.RIGHT
  },
  {
    code: "ContextMenu",
    key: "ContextMenu"
  },
  {
    code: "Tab",
    key: "Tab"
  },
  {
    code: "CapsLock",
    key: "CapsLock"
  },
  {
    code: "Backspace",
    key: "Backspace"
  },
  {
    code: "Enter",
    key: "Enter"
  },
  // function
  {
    code: "Escape",
    key: "Escape"
  },
  // arrows
  {
    code: "ArrowUp",
    key: "ArrowUp"
  },
  {
    code: "ArrowDown",
    key: "ArrowDown"
  },
  {
    code: "ArrowLeft",
    key: "ArrowLeft"
  },
  {
    code: "ArrowRight",
    key: "ArrowRight"
  },
  // control pad
  {
    code: "Home",
    key: "Home"
  },
  {
    code: "End",
    key: "End"
  },
  {
    code: "Delete",
    key: "Delete"
  },
  {
    code: "PageUp",
    key: "PageUp"
  },
  {
    code: "PageDown",
    key: "PageDown"
  },
  // Special keys that are not part of a default US-layout but included for specific behavior
  {
    code: "Fn",
    key: "Fn"
  },
  {
    code: "Symbol",
    key: "Symbol"
  },
  {
    code: "AltRight",
    key: "AltGraph"
  }
];

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/pointer/keyMap.js
var defaultKeyMap2 = [
  {
    name: "MouseLeft",
    pointerType: "mouse",
    button: "primary"
  },
  {
    name: "MouseRight",
    pointerType: "mouse",
    button: "secondary"
  },
  {
    name: "MouseMiddle",
    pointerType: "mouse",
    button: "auxiliary"
  },
  {
    name: "TouchA",
    pointerType: "touch"
  },
  {
    name: "TouchB",
    pointerType: "touch"
  },
  {
    name: "TouchC",
    pointerType: "touch"
  }
];

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/pointer/buttons.js
function _define_property4(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var Buttons = class {
  getButtons() {
    let v = 0;
    for (const button of Object.keys(this.pressed)) {
      v |= 2 ** Number(button);
    }
    return v;
  }
  down(keyDef) {
    const button = getMouseButtonId(keyDef.button);
    if (button in this.pressed) {
      this.pressed[button].push(keyDef);
      return void 0;
    }
    this.pressed[button] = [
      keyDef
    ];
    return button;
  }
  up(keyDef) {
    const button = getMouseButtonId(keyDef.button);
    if (button in this.pressed) {
      this.pressed[button] = this.pressed[button].filter((k) => k.name !== keyDef.name);
      if (this.pressed[button].length === 0) {
        delete this.pressed[button];
        return button;
      }
    }
    return void 0;
  }
  constructor() {
    _define_property4(this, "pressed", {});
  }
};
var MouseButton = {
  primary: 0,
  secondary: 1,
  auxiliary: 2,
  back: 3,
  X1: 3,
  forward: 4,
  X2: 4
};
function getMouseButtonId(button = 0) {
  if (button in MouseButton) {
    return MouseButton[button];
  }
  return Number(button);
}
var MouseButtonFlip = {
  1: 2,
  2: 1
};
function getMouseEventButton(button) {
  button = getMouseButtonId(button);
  if (button in MouseButtonFlip) {
    return MouseButtonFlip[button];
  }
  return button;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/pointer/device.js
function _define_property5(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var Device = class {
  get countPressed() {
    return this.pressedKeys.size;
  }
  isPressed(keyDef) {
    return this.pressedKeys.has(keyDef.name);
  }
  addPressed(keyDef) {
    return this.pressedKeys.add(keyDef.name);
  }
  removePressed(keyDef) {
    return this.pressedKeys.delete(keyDef.name);
  }
  constructor() {
    _define_property5(this, "pressedKeys", /* @__PURE__ */ new Set());
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/misc/getTreeDiff.js
function getTreeDiff(a, b) {
  const treeA = [];
  for (let el = a; el; el = el.parentElement) {
    treeA.push(el);
  }
  const treeB = [];
  for (let el = b; el; el = el.parentElement) {
    treeB.push(el);
  }
  let i = 0;
  for (; ; i++) {
    if (i >= treeA.length || i >= treeB.length || treeA[treeA.length - 1 - i] !== treeB[treeB.length - 1 - i]) {
      break;
    }
  }
  return [
    treeA.slice(0, treeA.length - i),
    treeB.slice(0, treeB.length - i),
    treeB.slice(treeB.length - i)
  ];
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/resolveCaretPosition.js
function resolveCaretPosition({ target, node, offset }) {
  if (hasOwnSelection(target)) {
    return {
      node: target,
      offset: offset !== null && offset !== void 0 ? offset : getUIValue(target).length
    };
  } else if (node) {
    return {
      node,
      offset: offset !== null && offset !== void 0 ? offset : node.nodeType === 3 ? node.nodeValue.length : node.childNodes.length
    };
  }
  return findNodeAtTextOffset(target, offset);
}
function findNodeAtTextOffset(node, offset, isRoot = true) {
  let i = offset === void 0 ? node.childNodes.length - 1 : 0;
  const step = offset === void 0 ? -1 : 1;
  while (offset === void 0 ? i >= (isRoot ? Math.max(node.childNodes.length - 1, 0) : 0) : i <= node.childNodes.length) {
    if (offset && i === node.childNodes.length) {
      throw new Error("The given offset is out of bounds.");
    }
    const c = node.childNodes.item(i);
    const text = String(c.textContent);
    if (text.length) {
      if (offset !== void 0 && text.length < offset) {
        offset -= text.length;
      } else if (c.nodeType === 1) {
        return findNodeAtTextOffset(c, offset, false);
      } else {
        if (c.nodeType === 3) {
          return {
            node: c,
            offset: offset !== null && offset !== void 0 ? offset : c.nodeValue.length
          };
        }
      }
    }
    i += step;
  }
  return {
    node,
    offset: node.childNodes.length
  };
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/setSelectionPerMouse.js
function setSelectionPerMouseDown({ document, target, clickCount, node, offset }) {
  if (hasNoSelection(target)) {
    return;
  }
  const targetHasOwnSelection = hasOwnSelection(target);
  const text = String(targetHasOwnSelection ? getUIValue(target) : target.textContent);
  const [start, end] = node ? (
    // which elements might be considered in the same line of text.
    // TODO: support expanding initial range on multiple clicks if node is given
    [
      offset,
      offset
    ]
  ) : getTextRange(text, offset, clickCount);
  if (targetHasOwnSelection) {
    setUISelection(target, {
      anchorOffset: start !== null && start !== void 0 ? start : text.length,
      focusOffset: end !== null && end !== void 0 ? end : text.length
    });
    return {
      node: target,
      start: start !== null && start !== void 0 ? start : 0,
      end: end !== null && end !== void 0 ? end : text.length
    };
  } else {
    const { node: startNode, offset: startOffset } = resolveCaretPosition({
      target,
      node,
      offset: start
    });
    const { node: endNode, offset: endOffset } = resolveCaretPosition({
      target,
      node,
      offset: end
    });
    const range = target.ownerDocument.createRange();
    try {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
    } catch (e) {
      throw new Error("The given offset is out of bounds.");
    }
    const selection = document.getSelection();
    selection === null || selection === void 0 ? void 0 : selection.removeAllRanges();
    selection === null || selection === void 0 ? void 0 : selection.addRange(range.cloneRange());
    return range;
  }
}
function getTextRange(text, pos, clickCount) {
  if (clickCount % 3 === 1 || text.length === 0) {
    return [
      pos,
      pos
    ];
  }
  const textPos = pos !== null && pos !== void 0 ? pos : text.length;
  if (clickCount % 3 === 2) {
    return [
      textPos - text.substr(0, pos).match(/(\w+|\s+|\W)?$/)[0].length,
      pos === void 0 ? pos : pos + text.substr(pos).match(/^(\w+|\s+|\W)?/)[0].length
    ];
  }
  return [
    textPos - text.substr(0, pos).match(/[^\r\n]*$/)[0].length,
    pos === void 0 ? pos : pos + text.substr(pos).match(/^[^\r\n]*/)[0].length
  ];
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/event/selection/modifySelectionPerMouse.js
function modifySelectionPerMouseMove(selectionRange, { document, target, node, offset }) {
  const selectionFocus = resolveCaretPosition({
    target,
    node,
    offset
  });
  if ("node" in selectionRange) {
    if (selectionFocus.node === selectionRange.node) {
      const anchorOffset = selectionFocus.offset < selectionRange.start ? selectionRange.end : selectionRange.start;
      const focusOffset = selectionFocus.offset > selectionRange.end || selectionFocus.offset < selectionRange.start ? selectionFocus.offset : selectionRange.end;
      setUISelection(selectionRange.node, {
        anchorOffset,
        focusOffset
      });
    }
  } else {
    const range = selectionRange.cloneRange();
    const cmp = range.comparePoint(selectionFocus.node, selectionFocus.offset);
    if (cmp < 0) {
      range.setStart(selectionFocus.node, selectionFocus.offset);
    } else if (cmp > 0) {
      range.setEnd(selectionFocus.node, selectionFocus.offset);
    }
    const selection = document.getSelection();
    selection === null || selection === void 0 ? void 0 : selection.removeAllRanges();
    selection === null || selection === void 0 ? void 0 : selection.addRange(range.cloneRange());
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/pointer/shared.js
function isDifferentPointerPosition(positionA, positionB) {
  var _positionA_coords, _positionB_coords, _positionA_coords1, _positionB_coords1, _positionA_coords2, _positionB_coords2, _positionA_coords3, _positionB_coords3, _positionA_coords4, _positionB_coords4, _positionA_coords5, _positionB_coords5, _positionA_coords6, _positionB_coords6, _positionA_coords7, _positionB_coords7, _positionA_coords8, _positionB_coords8, _positionA_coords9, _positionB_coords9, _positionA_caret, _positionB_caret, _positionA_caret1, _positionB_caret1;
  return positionA.target !== positionB.target || ((_positionA_coords = positionA.coords) === null || _positionA_coords === void 0 ? void 0 : _positionA_coords.x) !== ((_positionB_coords = positionB.coords) === null || _positionB_coords === void 0 ? void 0 : _positionB_coords.x) || ((_positionA_coords1 = positionA.coords) === null || _positionA_coords1 === void 0 ? void 0 : _positionA_coords1.y) !== ((_positionB_coords1 = positionB.coords) === null || _positionB_coords1 === void 0 ? void 0 : _positionB_coords1.y) || ((_positionA_coords2 = positionA.coords) === null || _positionA_coords2 === void 0 ? void 0 : _positionA_coords2.clientX) !== ((_positionB_coords2 = positionB.coords) === null || _positionB_coords2 === void 0 ? void 0 : _positionB_coords2.clientX) || ((_positionA_coords3 = positionA.coords) === null || _positionA_coords3 === void 0 ? void 0 : _positionA_coords3.clientY) !== ((_positionB_coords3 = positionB.coords) === null || _positionB_coords3 === void 0 ? void 0 : _positionB_coords3.clientY) || ((_positionA_coords4 = positionA.coords) === null || _positionA_coords4 === void 0 ? void 0 : _positionA_coords4.offsetX) !== ((_positionB_coords4 = positionB.coords) === null || _positionB_coords4 === void 0 ? void 0 : _positionB_coords4.offsetX) || ((_positionA_coords5 = positionA.coords) === null || _positionA_coords5 === void 0 ? void 0 : _positionA_coords5.offsetY) !== ((_positionB_coords5 = positionB.coords) === null || _positionB_coords5 === void 0 ? void 0 : _positionB_coords5.offsetY) || ((_positionA_coords6 = positionA.coords) === null || _positionA_coords6 === void 0 ? void 0 : _positionA_coords6.pageX) !== ((_positionB_coords6 = positionB.coords) === null || _positionB_coords6 === void 0 ? void 0 : _positionB_coords6.pageX) || ((_positionA_coords7 = positionA.coords) === null || _positionA_coords7 === void 0 ? void 0 : _positionA_coords7.pageY) !== ((_positionB_coords7 = positionB.coords) === null || _positionB_coords7 === void 0 ? void 0 : _positionB_coords7.pageY) || ((_positionA_coords8 = positionA.coords) === null || _positionA_coords8 === void 0 ? void 0 : _positionA_coords8.screenX) !== ((_positionB_coords8 = positionB.coords) === null || _positionB_coords8 === void 0 ? void 0 : _positionB_coords8.screenX) || ((_positionA_coords9 = positionA.coords) === null || _positionA_coords9 === void 0 ? void 0 : _positionA_coords9.screenY) !== ((_positionB_coords9 = positionB.coords) === null || _positionB_coords9 === void 0 ? void 0 : _positionB_coords9.screenY) || ((_positionA_caret = positionA.caret) === null || _positionA_caret === void 0 ? void 0 : _positionA_caret.node) !== ((_positionB_caret = positionB.caret) === null || _positionB_caret === void 0 ? void 0 : _positionB_caret.node) || ((_positionA_caret1 = positionA.caret) === null || _positionA_caret1 === void 0 ? void 0 : _positionA_caret1.offset) !== ((_positionB_caret1 = positionB.caret) === null || _positionB_caret1 === void 0 ? void 0 : _positionB_caret1.offset);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/pointer/mouse.js
function _define_property6(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var Mouse = class {
  move(instance, position, isPrevented) {
    const prevPosition = this.position;
    const prevTarget = this.getTarget(instance);
    this.position = position;
    if (!isDifferentPointerPosition(prevPosition, position)) {
      return;
    }
    const nextTarget = this.getTarget(instance);
    const init = this.getEventInit("mousemove");
    const [leave, enter] = getTreeDiff(prevTarget, nextTarget);
    return {
      leave: () => {
        if (prevTarget !== nextTarget) {
          instance.dispatchUIEvent(prevTarget, "mouseout", init);
          leave.forEach((el) => instance.dispatchUIEvent(el, "mouseleave", init));
        }
      },
      enter: () => {
        if (prevTarget !== nextTarget) {
          instance.dispatchUIEvent(nextTarget, "mouseover", init);
          enter.forEach((el) => instance.dispatchUIEvent(el, "mouseenter", init));
        }
      },
      move: () => {
        if (isPrevented) {
          return;
        }
        instance.dispatchUIEvent(nextTarget, "mousemove", init);
        this.modifySelecting(instance);
      }
    };
  }
  down(instance, keyDef, isPrevented) {
    const button = this.buttons.down(keyDef);
    if (button === void 0) {
      return;
    }
    const target = this.getTarget(instance);
    this.buttonDownTarget[button] = target;
    const init = this.getEventInit("mousedown", keyDef.button);
    const disabled = isDisabled(target);
    if (!isPrevented && (disabled || instance.dispatchUIEvent(target, "mousedown", init))) {
      this.startSelecting(instance, init.detail);
      focusElement(target);
    }
    if (!disabled && getMouseEventButton(keyDef.button) === 2) {
      instance.dispatchUIEvent(target, "contextmenu", this.getEventInit("contextmenu", keyDef.button));
    }
  }
  up(instance, keyDef, isPrevented) {
    const button = this.buttons.up(keyDef);
    if (button === void 0) {
      return;
    }
    const target = this.getTarget(instance);
    if (!isDisabled(target)) {
      if (!isPrevented) {
        const mouseUpInit = this.getEventInit("mouseup", keyDef.button);
        instance.dispatchUIEvent(target, "mouseup", mouseUpInit);
        this.endSelecting();
      }
      const clickTarget = getTreeDiff(this.buttonDownTarget[button], target)[2][0];
      if (clickTarget) {
        const init = this.getEventInit("click", keyDef.button);
        if (init.detail) {
          instance.dispatchUIEvent(clickTarget, init.button === 0 ? "click" : "auxclick", init);
          if (init.button === 0 && init.detail === 2) {
            instance.dispatchUIEvent(clickTarget, "dblclick", {
              ...this.getEventInit("dblclick", keyDef.button),
              detail: init.detail
            });
          }
        }
      }
    }
  }
  resetClickCount() {
    this.clickCount.reset();
  }
  getEventInit(type3, button) {
    const init = {
      ...this.position.coords
    };
    init.button = getMouseEventButton(button);
    init.buttons = this.buttons.getButtons();
    if (type3 === "mousedown") {
      init.detail = this.clickCount.getOnDown(init.button);
    } else if (type3 === "mouseup") {
      init.detail = this.clickCount.getOnUp(init.button);
    } else if (type3 === "click" || type3 === "auxclick") {
      init.detail = this.clickCount.incOnClick(init.button);
    }
    return init;
  }
  getTarget(instance) {
    var _this_position_target;
    return (_this_position_target = this.position.target) !== null && _this_position_target !== void 0 ? _this_position_target : instance.config.document.body;
  }
  startSelecting(instance, clickCount) {
    var _this_position_caret, _this_position_caret1;
    this.selecting = setSelectionPerMouseDown({
      document: instance.config.document,
      target: this.getTarget(instance),
      node: (_this_position_caret = this.position.caret) === null || _this_position_caret === void 0 ? void 0 : _this_position_caret.node,
      offset: (_this_position_caret1 = this.position.caret) === null || _this_position_caret1 === void 0 ? void 0 : _this_position_caret1.offset,
      clickCount
    });
  }
  modifySelecting(instance) {
    var _this_position_caret, _this_position_caret1;
    if (!this.selecting) {
      return;
    }
    modifySelectionPerMouseMove(this.selecting, {
      document: instance.config.document,
      target: this.getTarget(instance),
      node: (_this_position_caret = this.position.caret) === null || _this_position_caret === void 0 ? void 0 : _this_position_caret.node,
      offset: (_this_position_caret1 = this.position.caret) === null || _this_position_caret1 === void 0 ? void 0 : _this_position_caret1.offset
    });
  }
  endSelecting() {
    this.selecting = void 0;
  }
  constructor() {
    _define_property6(this, "position", {});
    _define_property6(this, "buttons", new Buttons());
    _define_property6(this, "selecting", void 0);
    _define_property6(this, "buttonDownTarget", {});
    _define_property6(this, "clickCount", new class {
      incOnClick(button) {
        const current = this.down[button] === void 0 ? void 0 : Number(this.down[button]) + 1;
        this.count = this.count[button] === void 0 ? {} : {
          [button]: Number(this.count[button]) + 1
        };
        return current;
      }
      getOnDown(button) {
        var _this_count_button;
        this.down = {
          [button]: (_this_count_button = this.count[button]) !== null && _this_count_button !== void 0 ? _this_count_button : 0
        };
        var _this_count_button1;
        this.count = {
          [button]: (_this_count_button1 = this.count[button]) !== null && _this_count_button1 !== void 0 ? _this_count_button1 : 0
        };
        return Number(this.count[button]) + 1;
      }
      getOnUp(button) {
        return this.down[button] === void 0 ? void 0 : Number(this.down[button]) + 1;
      }
      reset() {
        this.count = {};
      }
      constructor() {
        _define_property6(this, "down", {});
        _define_property6(this, "count", {});
      }
    }());
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/pointer/cssPointerEvents.js
function hasPointerEvents(instance, element) {
  var _checkPointerEvents;
  return ((_checkPointerEvents = checkPointerEvents(instance, element)) === null || _checkPointerEvents === void 0 ? void 0 : _checkPointerEvents.pointerEvents) !== "none";
}
function closestPointerEventsDeclaration(element) {
  const window = getWindow(element);
  for (let el = element, tree = []; el === null || el === void 0 ? void 0 : el.ownerDocument; el = el.parentElement) {
    tree.push(el);
    const pointerEvents = window.getComputedStyle(el).pointerEvents;
    if (pointerEvents && ![
      "inherit",
      "unset"
    ].includes(pointerEvents)) {
      return {
        pointerEvents,
        tree
      };
    }
  }
  return void 0;
}
var PointerEventsCheck = /* @__PURE__ */ Symbol("Last check for pointer-events");
function checkPointerEvents(instance, element) {
  const lastCheck = element[PointerEventsCheck];
  const needsCheck = instance.config.pointerEventsCheck !== PointerEventsCheckLevel.Never && (!lastCheck || hasBitFlag(instance.config.pointerEventsCheck, PointerEventsCheckLevel.EachApiCall) && lastCheck[ApiLevel.Call] !== getLevelRef(instance, ApiLevel.Call) || hasBitFlag(instance.config.pointerEventsCheck, PointerEventsCheckLevel.EachTrigger) && lastCheck[ApiLevel.Trigger] !== getLevelRef(instance, ApiLevel.Trigger));
  if (!needsCheck) {
    return lastCheck === null || lastCheck === void 0 ? void 0 : lastCheck.result;
  }
  const declaration = closestPointerEventsDeclaration(element);
  element[PointerEventsCheck] = {
    [ApiLevel.Call]: getLevelRef(instance, ApiLevel.Call),
    [ApiLevel.Trigger]: getLevelRef(instance, ApiLevel.Trigger),
    result: declaration
  };
  return declaration;
}
function assertPointerEvents(instance, element) {
  const declaration = checkPointerEvents(instance, element);
  if ((declaration === null || declaration === void 0 ? void 0 : declaration.pointerEvents) === "none") {
    throw new Error([
      `Unable to perform pointer interaction as the element ${declaration.tree.length > 1 ? "inherits" : "has"} \`pointer-events: none\`:`,
      "",
      printTree(declaration.tree)
    ].join("\n"));
  }
}
function printTree(tree) {
  return tree.reverse().map((el, i) => [
    "".padEnd(i),
    el.tagName,
    el.id && `#${el.id}`,
    el.hasAttribute("data-testid") && `(testId=${el.getAttribute("data-testid")})`,
    getLabelDescr(el),
    tree.length > 1 && i === 0 && "  <-- This element declared `pointer-events: none`",
    tree.length > 1 && i === tree.length - 1 && "  <-- Asserted pointer events here"
  ].filter(Boolean).join("")).join("\n");
}
function getLabelDescr(element) {
  var _element_labels;
  let label;
  if (element.hasAttribute("aria-label")) {
    label = element.getAttribute("aria-label");
  } else if (element.hasAttribute("aria-labelledby")) {
    var _element_ownerDocument_getElementById_textContent, _element_ownerDocument_getElementById;
    label = (_element_ownerDocument_getElementById = element.ownerDocument.getElementById(element.getAttribute("aria-labelledby"))) === null || _element_ownerDocument_getElementById === void 0 ? void 0 : (_element_ownerDocument_getElementById_textContent = _element_ownerDocument_getElementById.textContent) === null || _element_ownerDocument_getElementById_textContent === void 0 ? void 0 : _element_ownerDocument_getElementById_textContent.trim();
  } else if (isElementType(element, [
    "button",
    "input",
    "meter",
    "output",
    "progress",
    "select",
    "textarea"
  ]) && ((_element_labels = element.labels) === null || _element_labels === void 0 ? void 0 : _element_labels.length)) {
    label = Array.from(element.labels).map((el) => {
      var _el_textContent;
      return (_el_textContent = el.textContent) === null || _el_textContent === void 0 ? void 0 : _el_textContent.trim();
    }).join("|");
  } else if (isElementType(element, "button")) {
    var _element_textContent;
    label = (_element_textContent = element.textContent) === null || _element_textContent === void 0 ? void 0 : _element_textContent.trim();
  }
  label = label === null || label === void 0 ? void 0 : label.replace(/\n/g, "  ");
  if (Number(label === null || label === void 0 ? void 0 : label.length) > 30) {
    label = `${label === null || label === void 0 ? void 0 : label.substring(0, 29)}…`;
  }
  return label ? `(label=${label})` : "";
}
function hasBitFlag(conf, flag) {
  return (conf & flag) > 0;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/pointer/pointer.js
function _define_property7(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var Pointer = class {
  init(instance) {
    const target = this.getTarget(instance);
    const [, enter] = getTreeDiff(null, target);
    const init = this.getEventInit();
    assertPointerEvents(instance, target);
    instance.dispatchUIEvent(target, "pointerover", init);
    enter.forEach((el) => instance.dispatchUIEvent(el, "pointerenter", init));
    return this;
  }
  move(instance, position) {
    const prevPosition = this.position;
    const prevTarget = this.getTarget(instance);
    this.position = position;
    if (!isDifferentPointerPosition(prevPosition, position)) {
      return;
    }
    const nextTarget = this.getTarget(instance);
    const init = this.getEventInit(-1);
    const [leave, enter] = getTreeDiff(prevTarget, nextTarget);
    return {
      leave: () => {
        if (hasPointerEvents(instance, prevTarget)) {
          if (prevTarget !== nextTarget) {
            instance.dispatchUIEvent(prevTarget, "pointerout", init);
            leave.forEach((el) => instance.dispatchUIEvent(el, "pointerleave", init));
          }
        }
      },
      enter: () => {
        assertPointerEvents(instance, nextTarget);
        if (prevTarget !== nextTarget) {
          instance.dispatchUIEvent(nextTarget, "pointerover", init);
          enter.forEach((el) => instance.dispatchUIEvent(el, "pointerenter", init));
        }
      },
      move: () => {
        instance.dispatchUIEvent(nextTarget, "pointermove", init);
      }
    };
  }
  down(instance, button = 0) {
    if (this.isDown) {
      return;
    }
    const target = this.getTarget(instance);
    assertPointerEvents(instance, target);
    this.isDown = true;
    this.isPrevented = !instance.dispatchUIEvent(target, "pointerdown", this.getEventInit(button));
  }
  up(instance, button = 0) {
    if (!this.isDown) {
      return;
    }
    const target = this.getTarget(instance);
    assertPointerEvents(instance, target);
    this.isPrevented = false;
    this.isDown = false;
    instance.dispatchUIEvent(target, "pointerup", this.getEventInit(button));
  }
  release(instance) {
    const target = this.getTarget(instance);
    const [leave] = getTreeDiff(target, null);
    const init = this.getEventInit();
    if (hasPointerEvents(instance, target)) {
      instance.dispatchUIEvent(target, "pointerout", init);
      leave.forEach((el) => instance.dispatchUIEvent(el, "pointerleave", init));
    }
    this.isCancelled = true;
  }
  getTarget(instance) {
    var _this_position_target;
    return (_this_position_target = this.position.target) !== null && _this_position_target !== void 0 ? _this_position_target : instance.config.document.body;
  }
  getEventInit(button) {
    return {
      ...this.position.coords,
      pointerId: this.pointerId,
      pointerType: this.pointerType,
      isPrimary: this.isPrimary,
      button: getMouseEventButton(button),
      buttons: this.buttons.getButtons()
    };
  }
  constructor({ pointerId, pointerType, isPrimary }, buttons) {
    _define_property7(this, "pointerId", void 0);
    _define_property7(this, "pointerType", void 0);
    _define_property7(this, "isPrimary", void 0);
    _define_property7(this, "buttons", void 0);
    _define_property7(this, "isMultitouch", false);
    _define_property7(this, "isCancelled", false);
    _define_property7(this, "isDown", false);
    _define_property7(this, "isPrevented", false);
    _define_property7(this, "position", {});
    this.pointerId = pointerId;
    this.pointerType = pointerType;
    this.isPrimary = isPrimary;
    this.isMultitouch = !isPrimary;
    this.buttons = buttons;
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/pointer/index.js
function _define_property8(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var PointerHost = class {
  isKeyPressed(keyDef) {
    return this.devices.get(keyDef.pointerType).isPressed(keyDef);
  }
  async press(instance, keyDef, position) {
    this.devices.get(keyDef.pointerType).addPressed(keyDef);
    this.buttons.down(keyDef);
    const pointerName = this.getPointerName(keyDef);
    const pointer3 = keyDef.pointerType === "touch" ? this.pointers.new(pointerName, keyDef.pointerType, this.buttons) : this.pointers.get(pointerName);
    pointer3.position = position;
    if (pointer3.pointerType !== "touch") {
      this.mouse.position = position;
    }
    if (pointer3.pointerType === "touch") {
      pointer3.init(instance);
    }
    pointer3.down(instance, keyDef.button);
    if (pointer3.pointerType !== "touch") {
      this.mouse.down(instance, keyDef, pointer3.isPrevented);
    }
  }
  async move(instance, pointerName, position) {
    const pointer3 = this.pointers.get(pointerName);
    const pointermove = pointer3.move(instance, position);
    const mousemove = pointer3.pointerType === "touch" ? void 0 : this.mouse.move(instance, position, pointer3.isPrevented);
    pointermove === null || pointermove === void 0 ? void 0 : pointermove.leave();
    mousemove === null || mousemove === void 0 ? void 0 : mousemove.leave();
    pointermove === null || pointermove === void 0 ? void 0 : pointermove.enter();
    mousemove === null || mousemove === void 0 ? void 0 : mousemove.enter();
    pointermove === null || pointermove === void 0 ? void 0 : pointermove.move();
    mousemove === null || mousemove === void 0 ? void 0 : mousemove.move();
  }
  async release(instance, keyDef, position) {
    const device = this.devices.get(keyDef.pointerType);
    device.removePressed(keyDef);
    this.buttons.up(keyDef);
    const pointer3 = this.pointers.get(this.getPointerName(keyDef));
    const isPrevented = pointer3.isPrevented;
    pointer3.position = position;
    if (pointer3.pointerType !== "touch") {
      this.mouse.position = position;
    }
    if (device.countPressed === 0) {
      pointer3.up(instance, keyDef.button);
    }
    if (pointer3.pointerType === "touch") {
      pointer3.release(instance);
    }
    if (pointer3.pointerType === "touch" && !pointer3.isMultitouch) {
      const mousemove = this.mouse.move(instance, position, isPrevented);
      mousemove === null || mousemove === void 0 ? void 0 : mousemove.leave();
      mousemove === null || mousemove === void 0 ? void 0 : mousemove.enter();
      mousemove === null || mousemove === void 0 ? void 0 : mousemove.move();
      this.mouse.down(instance, keyDef, isPrevented);
    }
    if (!pointer3.isMultitouch) {
      const mousemove = this.mouse.move(instance, position, isPrevented);
      mousemove === null || mousemove === void 0 ? void 0 : mousemove.leave();
      mousemove === null || mousemove === void 0 ? void 0 : mousemove.enter();
      mousemove === null || mousemove === void 0 ? void 0 : mousemove.move();
      this.mouse.up(instance, keyDef, isPrevented);
    }
  }
  getPointerName(keyDef) {
    return keyDef.pointerType === "touch" ? keyDef.name : keyDef.pointerType;
  }
  getPreviousPosition(pointerName) {
    return this.pointers.has(pointerName) ? this.pointers.get(pointerName).position : void 0;
  }
  resetClickCount() {
    this.mouse.resetClickCount();
  }
  getMouseTarget(instance) {
    var _this_mouse_position_target;
    return (_this_mouse_position_target = this.mouse.position.target) !== null && _this_mouse_position_target !== void 0 ? _this_mouse_position_target : instance.config.document.body;
  }
  setMousePosition(position) {
    this.mouse.position = position;
    this.pointers.get("mouse").position = position;
  }
  constructor(system) {
    _define_property8(this, "system", void 0);
    _define_property8(this, "mouse", void 0);
    _define_property8(this, "buttons", void 0);
    _define_property8(this, "devices", new class {
      get(k) {
        var _this_registry, _k;
        var _;
        return (_ = (_this_registry = this.registry)[_k = k]) !== null && _ !== void 0 ? _ : _this_registry[_k] = new Device();
      }
      constructor() {
        _define_property8(this, "registry", {});
      }
    }());
    _define_property8(this, "pointers", new class {
      new(pointerName, pointerType, buttons) {
        const isPrimary = pointerType !== "touch" || !Object.values(this.registry).some((p) => p.pointerType === "touch" && !p.isCancelled);
        if (!isPrimary) {
          Object.values(this.registry).forEach((p) => {
            if (p.pointerType === pointerType && !p.isCancelled) {
              p.isMultitouch = true;
            }
          });
        }
        this.registry[pointerName] = new Pointer({
          pointerId: this.nextId++,
          pointerType,
          isPrimary
        }, buttons);
        return this.registry[pointerName];
      }
      get(pointerName) {
        if (!this.has(pointerName)) {
          throw new Error(`Trying to access pointer "${pointerName}" which does not exist.`);
        }
        return this.registry[pointerName];
      }
      has(pointerName) {
        return pointerName in this.registry;
      }
      constructor() {
        _define_property8(this, "registry", {});
        _define_property8(this, "nextId", 1);
      }
    }());
    this.system = system;
    this.buttons = new Buttons();
    this.mouse = new Mouse();
    this.pointers.new("mouse", "mouse", this.buttons);
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/system/index.js
function _define_property9(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
var System = class {
  getUIEventModifiers() {
    return {
      altKey: this.keyboard.modifiers.Alt,
      ctrlKey: this.keyboard.modifiers.Control,
      metaKey: this.keyboard.modifiers.Meta,
      shiftKey: this.keyboard.modifiers.Shift,
      modifierAltGraph: this.keyboard.modifiers.AltGraph,
      modifierCapsLock: this.keyboard.modifiers.CapsLock,
      modifierFn: this.keyboard.modifiers.Fn,
      modifierFnLock: this.keyboard.modifiers.FnLock,
      modifierNumLock: this.keyboard.modifiers.NumLock,
      modifierScrollLock: this.keyboard.modifiers.ScrollLock,
      modifierSymbol: this.keyboard.modifiers.Symbol,
      modifierSymbolLock: this.keyboard.modifiers.SymbolLock
    };
  }
  constructor() {
    _define_property9(this, "keyboard", new KeyboardHost(this));
    _define_property9(this, "pointer", new PointerHost(this));
  }
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/convenience/click.js
async function click(element) {
  const pointerIn = [];
  if (!this.config.skipHover) {
    pointerIn.push({
      target: element
    });
  }
  pointerIn.push({
    keys: "[MouseLeft]",
    target: element
  });
  return this.pointer(pointerIn);
}
async function dblClick(element) {
  return this.pointer([
    {
      target: element
    },
    "[MouseLeft][MouseLeft]"
  ]);
}
async function tripleClick(element) {
  return this.pointer([
    {
      target: element
    },
    "[MouseLeft][MouseLeft][MouseLeft]"
  ]);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/convenience/hover.js
async function hover(element) {
  return this.pointer({
    target: element
  });
}
async function unhover(element) {
  assertPointerEvents(this, this.system.pointer.getMouseTarget(this));
  return this.pointer({
    target: element.ownerDocument.body
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/convenience/tab.js
async function tab({ shift } = {}) {
  return this.keyboard(shift === true ? "{Shift>}{Tab}{/Shift}" : shift === false ? "[/ShiftLeft][/ShiftRight]{Tab}" : "{Tab}");
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/keyDef/readNextDescriptor.js
var bracketDict = (function(bracketDict2) {
  bracketDict2["{"] = "}";
  bracketDict2["["] = "]";
  return bracketDict2;
})(bracketDict || {});
function readNextDescriptor(text, context) {
  let pos = 0;
  const startBracket = text[pos] in bracketDict ? text[pos] : "";
  pos += startBracket.length;
  const isEscapedChar = new RegExp(`^\\${startBracket}{2}`).test(text);
  const type3 = isEscapedChar ? "" : startBracket;
  return {
    type: type3,
    ...type3 === "" ? readPrintableChar(text, pos, context) : readTag(text, pos, type3, context)
  };
}
function readPrintableChar(text, pos, context) {
  const descriptor = text[pos];
  assertDescriptor(descriptor, text, pos, context);
  pos += descriptor.length;
  return {
    consumedLength: pos,
    descriptor,
    releasePrevious: false,
    releaseSelf: true,
    repeat: 1
  };
}
function readTag(text, pos, startBracket, context) {
  var _text_slice_match, _text_slice_match1;
  const releasePreviousModifier = text[pos] === "/" ? "/" : "";
  pos += releasePreviousModifier.length;
  const escapedDescriptor = startBracket === "{" && text[pos] === "\\";
  pos += Number(escapedDescriptor);
  const descriptor = escapedDescriptor ? text[pos] : (_text_slice_match = text.slice(pos).match(startBracket === "{" ? /^\w+|^[^}>/]/ : /^\w+/)) === null || _text_slice_match === void 0 ? void 0 : _text_slice_match[0];
  assertDescriptor(descriptor, text, pos, context);
  pos += descriptor.length;
  var _text_slice_match_;
  const repeatModifier = (_text_slice_match_ = (_text_slice_match1 = text.slice(pos).match(/^>\d+/)) === null || _text_slice_match1 === void 0 ? void 0 : _text_slice_match1[0]) !== null && _text_slice_match_ !== void 0 ? _text_slice_match_ : "";
  pos += repeatModifier.length;
  const releaseSelfModifier = text[pos] === "/" || !repeatModifier && text[pos] === ">" ? text[pos] : "";
  pos += releaseSelfModifier.length;
  const expectedEndBracket = bracketDict[startBracket];
  const endBracket = text[pos] === expectedEndBracket ? expectedEndBracket : "";
  if (!endBracket) {
    throw new Error(getErrorMessage([
      !repeatModifier && "repeat modifier",
      !releaseSelfModifier && "release modifier",
      `"${expectedEndBracket}"`
    ].filter(Boolean).join(" or "), text[pos], text, context));
  }
  pos += endBracket.length;
  return {
    consumedLength: pos,
    descriptor,
    releasePrevious: !!releasePreviousModifier,
    repeat: repeatModifier ? Math.max(Number(repeatModifier.substr(1)), 1) : 1,
    releaseSelf: hasReleaseSelf(releaseSelfModifier, repeatModifier)
  };
}
function assertDescriptor(descriptor, text, pos, context) {
  if (!descriptor) {
    throw new Error(getErrorMessage("key descriptor", text[pos], text, context));
  }
}
function hasReleaseSelf(releaseSelfModifier, repeatModifier) {
  if (releaseSelfModifier) {
    return releaseSelfModifier === "/";
  }
  if (repeatModifier) {
    return false;
  }
}
function getErrorMessage(expected, found, text, context) {
  return `Expected ${expected} but found "${found !== null && found !== void 0 ? found : ""}" in "${text}"
    See ${context === "pointer" ? `https://testing-library.com/docs/user-event/pointer#pressing-a-button-or-touching-the-screen` : `https://testing-library.com/docs/user-event/keyboard`}
    for more information about how userEvent parses your input.`;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js
function parseKeyDef(keyboardMap, text) {
  const defs = [];
  do {
    const { type: type3, descriptor, consumedLength, releasePrevious, releaseSelf = true, repeat } = readNextDescriptor(text, "keyboard");
    var _keyboardMap_find;
    const keyDef = (_keyboardMap_find = keyboardMap.find((def) => {
      if (type3 === "[") {
        var _def_code;
        return ((_def_code = def.code) === null || _def_code === void 0 ? void 0 : _def_code.toLowerCase()) === descriptor.toLowerCase();
      } else if (type3 === "{") {
        var _def_key;
        return ((_def_key = def.key) === null || _def_key === void 0 ? void 0 : _def_key.toLowerCase()) === descriptor.toLowerCase();
      }
      return def.key === descriptor;
    })) !== null && _keyboardMap_find !== void 0 ? _keyboardMap_find : {
      key: "Unknown",
      code: "Unknown",
      [type3 === "[" ? "code" : "key"]: descriptor
    };
    defs.push({
      keyDef,
      releasePrevious,
      releaseSelf,
      repeat
    });
    text = text.slice(consumedLength);
  } while (text);
  return defs;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/keyboard/index.js
async function keyboard(text) {
  const actions = parseKeyDef(this.config.keyboardMap, text);
  for (let i = 0; i < actions.length; i++) {
    await wait(this.config);
    await keyboardAction(this, actions[i]);
  }
}
async function keyboardAction(instance, { keyDef, releasePrevious, releaseSelf, repeat }) {
  const { system } = instance;
  if (system.keyboard.isKeyPressed(keyDef)) {
    await system.keyboard.keyup(instance, keyDef);
  }
  if (!releasePrevious) {
    for (let i = 1; i <= repeat; i++) {
      await system.keyboard.keydown(instance, keyDef);
      if (i < repeat) {
        await wait(instance.config);
      }
    }
    if (releaseSelf) {
      await system.keyboard.keyup(instance, keyDef);
    }
  }
}
async function releaseAllKeys(instance) {
  for (const k of instance.system.keyboard.getPressedKeys()) {
    await instance.system.keyboard.keyup(instance, k);
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/document/copySelection.js
function copySelection(target) {
  const data = hasOwnSelection(target) ? {
    "text/plain": readSelectedValueFromInput(target)
  } : {
    "text/plain": String(target.ownerDocument.getSelection())
  };
  const dt = createDataTransfer(getWindow(target));
  for (const type3 in data) {
    if (data[type3]) {
      dt.setData(type3, data[type3]);
    }
  }
  return dt;
}
function readSelectedValueFromInput(target) {
  const sel = getUISelection(target);
  const val = getUIValue(target);
  return val.substring(sel.startOffset, sel.endOffset);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/clipboard/copy.js
async function copy() {
  const doc = this.config.document;
  var _doc_activeElement;
  const target = (_doc_activeElement = doc.activeElement) !== null && _doc_activeElement !== void 0 ? _doc_activeElement : (
    /* istanbul ignore next */
    doc.body
  );
  const clipboardData = copySelection(target);
  if (clipboardData.items.length === 0) {
    return;
  }
  if (this.dispatchUIEvent(target, "copy", {
    clipboardData
  }) && this.config.writeToClipboard) {
    await writeDataTransferToClipboard(doc, clipboardData);
  }
  return clipboardData;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/clipboard/cut.js
async function cut() {
  const doc = this.config.document;
  var _doc_activeElement;
  const target = (_doc_activeElement = doc.activeElement) !== null && _doc_activeElement !== void 0 ? _doc_activeElement : (
    /* istanbul ignore next */
    doc.body
  );
  const clipboardData = copySelection(target);
  if (clipboardData.items.length === 0) {
    return;
  }
  if (this.dispatchUIEvent(target, "cut", {
    clipboardData
  }) && this.config.writeToClipboard) {
    await writeDataTransferToClipboard(target.ownerDocument, clipboardData);
  }
  return clipboardData;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/clipboard/paste.js
async function paste(clipboardData) {
  const doc = this.config.document;
  var _doc_activeElement;
  const target = (_doc_activeElement = doc.activeElement) !== null && _doc_activeElement !== void 0 ? _doc_activeElement : (
    /* istanbul ignore next */
    doc.body
  );
  var _ref;
  const dataTransfer = (_ref = typeof clipboardData === "string" ? getClipboardDataFromString(doc, clipboardData) : clipboardData) !== null && _ref !== void 0 ? _ref : await readDataTransferFromClipboard(doc).catch(() => {
    throw new Error("`userEvent.paste()` without `clipboardData` requires the `ClipboardAPI` to be available.");
  });
  this.dispatchUIEvent(target, "paste", {
    clipboardData: dataTransfer
  });
}
function getClipboardDataFromString(doc, text) {
  const dt = createDataTransfer(getWindow(doc));
  dt.setData("text", text);
  return dt;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/pointer/parseKeyDef.js
function parseKeyDef2(pointerMap, keys) {
  const defs = [];
  do {
    const { descriptor, consumedLength, releasePrevious, releaseSelf = true } = readNextDescriptor(keys, "pointer");
    const keyDef = pointerMap.find((p) => p.name === descriptor);
    if (keyDef) {
      defs.push({
        keyDef,
        releasePrevious,
        releaseSelf
      });
    }
    keys = keys.slice(consumedLength);
  } while (keys);
  return defs;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/pointer/index.js
async function pointer(input2) {
  const { pointerMap } = this.config;
  const actions = [];
  (Array.isArray(input2) ? input2 : [
    input2
  ]).forEach((actionInput) => {
    if (typeof actionInput === "string") {
      actions.push(...parseKeyDef2(pointerMap, actionInput));
    } else if ("keys" in actionInput) {
      actions.push(...parseKeyDef2(pointerMap, actionInput.keys).map((i) => ({
        ...actionInput,
        ...i
      })));
    } else {
      actions.push(actionInput);
    }
  });
  for (let i = 0; i < actions.length; i++) {
    await wait(this.config);
    await pointerAction(this, actions[i]);
  }
  this.system.pointer.resetClickCount();
}
async function pointerAction(instance, action) {
  var _previousPosition_caret, _previousPosition_caret1;
  const pointerName = "pointerName" in action && action.pointerName ? action.pointerName : "keyDef" in action ? instance.system.pointer.getPointerName(action.keyDef) : "mouse";
  const previousPosition = instance.system.pointer.getPreviousPosition(pointerName);
  var _action_target, _action_coords, _action_node, _action_offset;
  const position = {
    target: (_action_target = action.target) !== null && _action_target !== void 0 ? _action_target : getPrevTarget(instance, previousPosition),
    coords: (_action_coords = action.coords) !== null && _action_coords !== void 0 ? _action_coords : previousPosition === null || previousPosition === void 0 ? void 0 : previousPosition.coords,
    caret: {
      node: (_action_node = action.node) !== null && _action_node !== void 0 ? _action_node : hasCaretPosition(action) ? void 0 : previousPosition === null || previousPosition === void 0 ? void 0 : (_previousPosition_caret = previousPosition.caret) === null || _previousPosition_caret === void 0 ? void 0 : _previousPosition_caret.node,
      offset: (_action_offset = action.offset) !== null && _action_offset !== void 0 ? _action_offset : hasCaretPosition(action) ? void 0 : previousPosition === null || previousPosition === void 0 ? void 0 : (_previousPosition_caret1 = previousPosition.caret) === null || _previousPosition_caret1 === void 0 ? void 0 : _previousPosition_caret1.offset
    }
  };
  if ("keyDef" in action) {
    if (instance.system.pointer.isKeyPressed(action.keyDef)) {
      setLevelRef(instance, ApiLevel.Trigger);
      await instance.system.pointer.release(instance, action.keyDef, position);
    }
    if (!action.releasePrevious) {
      setLevelRef(instance, ApiLevel.Trigger);
      await instance.system.pointer.press(instance, action.keyDef, position);
      if (action.releaseSelf) {
        setLevelRef(instance, ApiLevel.Trigger);
        await instance.system.pointer.release(instance, action.keyDef, position);
      }
    }
  } else {
    setLevelRef(instance, ApiLevel.Trigger);
    await instance.system.pointer.move(instance, pointerName, position);
  }
}
function hasCaretPosition(action) {
  var _action_target, _ref;
  return !!((_ref = (_action_target = action.target) !== null && _action_target !== void 0 ? _action_target : action.node) !== null && _ref !== void 0 ? _ref : action.offset !== void 0);
}
function getPrevTarget(instance, position) {
  if (!position) {
    throw new Error("This pointer has no previous position. Provide a target property!");
  }
  var _position_target;
  return (_position_target = position.target) !== null && _position_target !== void 0 ? _position_target : instance.config.document.body;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utility/clear.js
async function clear(element) {
  if (!isEditable(element) || isDisabled(element)) {
    throw new Error("clear()` is only supported on editable elements.");
  }
  focusElement(element);
  if (element.ownerDocument.activeElement !== element) {
    throw new Error("The element to be cleared could not be focused.");
  }
  selectAll(element);
  if (!isAllSelected(element)) {
    throw new Error("The element content to be cleared could not be selected.");
  }
  input(this, element, "", "deleteContentBackward");
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utility/selectOptions.js
async function selectOptions(select, values) {
  return selectOptionsBase.call(this, true, select, values);
}
async function deselectOptions(select, values) {
  return selectOptionsBase.call(this, false, select, values);
}
async function selectOptionsBase(newValue, select, values) {
  if (!newValue && !select.multiple) {
    throw getConfig().getElementError(`Unable to deselect an option in a non-multiple select. Use selectOptions to change the selection instead.`, select);
  }
  const valArray = Array.isArray(values) ? values : [
    values
  ];
  const allOptions = Array.from(select.querySelectorAll('option, [role="option"]'));
  const selectedOptions = valArray.map((val) => {
    if (typeof val !== "string" && allOptions.includes(val)) {
      return val;
    } else {
      const matchingOption = allOptions.find((o) => o.value === val || o.innerHTML === val);
      if (matchingOption) {
        return matchingOption;
      } else {
        throw getConfig().getElementError(`Value "${String(val)}" not found in options`, select);
      }
    }
  }).filter((option) => !isDisabled(option));
  if (isDisabled(select) || !selectedOptions.length) return;
  const selectOption = (option) => {
    option.selected = newValue;
    this.dispatchUIEvent(select, "input", {
      bubbles: true,
      cancelable: false,
      composed: true
    });
    this.dispatchUIEvent(select, "change");
  };
  if (isElementType(select, "select")) {
    if (select.multiple) {
      for (const option of selectedOptions) {
        const withPointerEvents = this.config.pointerEventsCheck === 0 ? true : hasPointerEvents(this, option);
        if (withPointerEvents) {
          this.dispatchUIEvent(option, "pointerover");
          this.dispatchUIEvent(select, "pointerenter");
          this.dispatchUIEvent(option, "mouseover");
          this.dispatchUIEvent(select, "mouseenter");
          this.dispatchUIEvent(option, "pointermove");
          this.dispatchUIEvent(option, "mousemove");
          this.dispatchUIEvent(option, "pointerdown");
          this.dispatchUIEvent(option, "mousedown");
        }
        focusElement(select);
        if (withPointerEvents) {
          this.dispatchUIEvent(option, "pointerup");
          this.dispatchUIEvent(option, "mouseup");
        }
        selectOption(option);
        if (withPointerEvents) {
          this.dispatchUIEvent(option, "click");
        }
        await wait(this.config);
      }
    } else if (selectedOptions.length === 1) {
      const withPointerEvents = this.config.pointerEventsCheck === 0 ? true : hasPointerEvents(this, select);
      if (withPointerEvents) {
        await this.click(select);
      } else {
        focusElement(select);
      }
      selectOption(selectedOptions[0]);
      if (withPointerEvents) {
        this.dispatchUIEvent(select, "pointerover");
        this.dispatchUIEvent(select, "pointerenter");
        this.dispatchUIEvent(select, "mouseover");
        this.dispatchUIEvent(select, "mouseenter");
        this.dispatchUIEvent(select, "pointerup");
        this.dispatchUIEvent(select, "mouseup");
        this.dispatchUIEvent(select, "click");
      }
      await wait(this.config);
    } else {
      throw getConfig().getElementError(`Cannot select multiple options on a non-multiple select`, select);
    }
  } else if (select.getAttribute("role") === "listbox") {
    for (const option of selectedOptions) {
      await this.click(option);
      await this.unhover(option);
    }
  } else {
    throw getConfig().getElementError(`Cannot select options on elements that are neither select nor listbox elements`, select);
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utility/type.js
async function type(element, text, { skipClick = this.config.skipClick, skipAutoClose = this.config.skipAutoClose, initialSelectionStart, initialSelectionEnd } = {}) {
  if (element.disabled) return;
  if (!skipClick) {
    await this.click(element);
  }
  if (initialSelectionStart !== void 0) {
    setSelectionRange(element, initialSelectionStart, initialSelectionEnd !== null && initialSelectionEnd !== void 0 ? initialSelectionEnd : initialSelectionStart);
  }
  await this.keyboard(text);
  if (!skipAutoClose) {
    await releaseAllKeys(this);
  }
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utils/edit/setFiles.js
var fakeFiles = /* @__PURE__ */ Symbol("files and value properties are mocked");
function restoreProperty(obj, prop, descriptor) {
  if (descriptor) {
    Object.defineProperty(obj, prop, descriptor);
  } else {
    delete obj[prop];
  }
}
function setFiles(el, files) {
  var _el_fakeFiles;
  (_el_fakeFiles = el[fakeFiles]) === null || _el_fakeFiles === void 0 ? void 0 : _el_fakeFiles.restore();
  const typeDescr = Object.getOwnPropertyDescriptor(el, "type");
  const valueDescr = Object.getOwnPropertyDescriptor(el, "value");
  const filesDescr = Object.getOwnPropertyDescriptor(el, "files");
  function restore() {
    restoreProperty(el, "type", typeDescr);
    restoreProperty(el, "value", valueDescr);
    restoreProperty(el, "files", filesDescr);
  }
  el[fakeFiles] = {
    restore
  };
  Object.defineProperties(el, {
    files: {
      configurable: true,
      get: () => files
    },
    value: {
      configurable: true,
      get: () => files.length ? `C:\\fakepath\\${files[0].name}` : "",
      set(v) {
        if (v === "") {
          restore();
        } else {
          var _valueDescr_set;
          valueDescr === null || valueDescr === void 0 ? void 0 : (_valueDescr_set = valueDescr.set) === null || _valueDescr_set === void 0 ? void 0 : _valueDescr_set.call(el, v);
        }
      }
    },
    type: {
      configurable: true,
      get: () => "file",
      set(v) {
        if (v !== "file") {
          restore();
          el.type = v;
        }
      }
    }
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/utility/upload.js
async function upload(element, fileOrFiles) {
  const input2 = isElementType(element, "label") ? element.control : element;
  if (!input2 || !isElementType(input2, "input", {
    type: "file"
  })) {
    throw new TypeError(`The ${input2 === element ? "given" : "associated"} ${input2 === null || input2 === void 0 ? void 0 : input2.tagName} element does not accept file uploads`);
  }
  if (isDisabled(element)) return;
  const files = (Array.isArray(fileOrFiles) ? fileOrFiles : [
    fileOrFiles
  ]).filter((file) => !this.config.applyAccept || isAcceptableFile(file, input2.accept)).slice(0, input2.multiple ? void 0 : 1);
  const fileDialog = () => {
    var _input_files;
    if (files.length === ((_input_files = input2.files) === null || _input_files === void 0 ? void 0 : _input_files.length) && files.every((f, i) => {
      var _input_files2;
      return f === ((_input_files2 = input2.files) === null || _input_files2 === void 0 ? void 0 : _input_files2.item(i));
    })) {
      return;
    }
    setFiles(input2, createFileList(getWindow(element), files));
    this.dispatchUIEvent(input2, "input");
    this.dispatchUIEvent(input2, "change");
  };
  input2.addEventListener("fileDialog", fileDialog);
  await this.click(element);
  input2.removeEventListener("fileDialog", fileDialog);
}
function normalize(nameOrType) {
  return nameOrType.toLowerCase().replace(/(\.|\/)jpg\b/g, "$1jpeg");
}
function isAcceptableFile(file, accept) {
  if (!accept) {
    return true;
  }
  const wildcards = [
    "audio/*",
    "image/*",
    "video/*"
  ];
  return normalize(accept).trim().split(/\s*,\s*/).some((acceptToken) => {
    if (acceptToken.startsWith(".")) {
      return normalize(file.name).endsWith(acceptToken);
    } else if (wildcards.includes(acceptToken)) {
      return normalize(file.type).startsWith(acceptToken.replace("*", ""));
    }
    return normalize(file.type) === acceptToken;
  });
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/setup/api.js
var userEventApi = {
  click,
  dblClick,
  tripleClick,
  hover,
  unhover,
  tab,
  keyboard,
  copy,
  cut,
  paste,
  pointer,
  clear,
  deselectOptions,
  selectOptions,
  type,
  upload
};

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/setup/wrapAsync.js
function wrapAsync(implementation) {
  return getConfig().asyncWrapper(implementation);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/setup/setup.js
var defaultOptionsDirect = {
  applyAccept: true,
  autoModify: true,
  delay: 0,
  document: globalThis.document,
  keyboardMap: defaultKeyMap,
  pointerMap: defaultKeyMap2,
  pointerEventsCheck: PointerEventsCheckLevel.EachApiCall,
  skipAutoClose: false,
  skipClick: false,
  skipHover: false,
  writeToClipboard: false,
  advanceTimers: () => Promise.resolve()
};
var defaultOptionsSetup = {
  ...defaultOptionsDirect,
  writeToClipboard: true
};
function createConfig(options = {}, defaults = defaultOptionsSetup, node) {
  const document = getDocument(options, node, defaults);
  return {
    ...defaults,
    ...options,
    document
  };
}
function setupMain(options = {}) {
  const config = createConfig(options);
  prepareDocument(config.document);
  patchFocus(getWindow(config.document).HTMLElement);
  var _config_document_defaultView;
  const view = (_config_document_defaultView = config.document.defaultView) !== null && _config_document_defaultView !== void 0 ? _config_document_defaultView : (
    /* istanbul ignore next */
    globalThis.window
  );
  attachClipboardStubToView(view);
  return createInstance(config).api;
}
function setupDirect({ keyboardState, pointerState, ...options } = {}, node) {
  const config = createConfig(options, defaultOptionsDirect, node);
  prepareDocument(config.document);
  patchFocus(getWindow(config.document).HTMLElement);
  var _ref;
  const system = (_ref = pointerState !== null && pointerState !== void 0 ? pointerState : keyboardState) !== null && _ref !== void 0 ? _ref : new System();
  return {
    api: createInstance(config, system).api,
    system
  };
}
function setupSub(options) {
  return createInstance({
    ...this.config,
    ...options
  }, this.system).api;
}
function wrapAndBindImpl(instance, impl) {
  function method(...args) {
    setLevelRef(instance, ApiLevel.Call);
    return wrapAsync(() => impl.apply(instance, args).then(async (ret) => {
      await wait(instance.config);
      return ret;
    }));
  }
  Object.defineProperty(method, "name", {
    get: () => impl.name
  });
  return method;
}
function createInstance(config, system = new System()) {
  const instance = {};
  Object.assign(instance, {
    config,
    dispatchEvent: dispatchEvent.bind(instance),
    dispatchUIEvent: dispatchUIEvent.bind(instance),
    system,
    levelRefs: {},
    ...userEventApi
  });
  return {
    instance,
    api: {
      ...Object.fromEntries(Object.entries(userEventApi).map(([name, api]) => [
        name,
        wrapAndBindImpl(instance, api)
      ])),
      setup: setupSub.bind(instance)
    }
  };
}
function getDocument(options, node, defaults) {
  var _options_document, _ref;
  return (_ref = (_options_document = options.document) !== null && _options_document !== void 0 ? _options_document : node && getDocumentFromNode(node)) !== null && _ref !== void 0 ? _ref : defaults.document;
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/setup/directApi.js
var directApi_exports = {};
__export(directApi_exports, {
  clear: () => clear2,
  click: () => click2,
  copy: () => copy2,
  cut: () => cut2,
  dblClick: () => dblClick2,
  deselectOptions: () => deselectOptions2,
  hover: () => hover2,
  keyboard: () => keyboard2,
  paste: () => paste2,
  pointer: () => pointer2,
  selectOptions: () => selectOptions2,
  tab: () => tab2,
  tripleClick: () => tripleClick2,
  type: () => type2,
  unhover: () => unhover2,
  upload: () => upload2
});
function clear2(element) {
  return setupDirect().api.clear(element);
}
function click2(element, options = {}) {
  return setupDirect(options, element).api.click(element);
}
function copy2(options = {}) {
  return setupDirect(options).api.copy();
}
function cut2(options = {}) {
  return setupDirect(options).api.cut();
}
function dblClick2(element, options = {}) {
  return setupDirect(options).api.dblClick(element);
}
function deselectOptions2(select, values, options = {}) {
  return setupDirect(options).api.deselectOptions(select, values);
}
function hover2(element, options = {}) {
  return setupDirect(options).api.hover(element);
}
async function keyboard2(text, options = {}) {
  const { api, system } = setupDirect(options);
  return api.keyboard(text).then(() => system);
}
async function pointer2(input2, options = {}) {
  const { api, system } = setupDirect(options);
  return api.pointer(input2).then(() => system);
}
function paste2(clipboardData, options) {
  return setupDirect(options).api.paste(clipboardData);
}
function selectOptions2(select, values, options = {}) {
  return setupDirect(options).api.selectOptions(select, values);
}
function tripleClick2(element, options = {}) {
  return setupDirect(options).api.tripleClick(element);
}
function type2(element, text, options = {}) {
  return setupDirect(options, element).api.type(element, text, options);
}
function unhover2(element, options = {}) {
  const { api, system } = setupDirect(options);
  system.pointer.setMousePosition({
    target: element
  });
  return api.unhover(element);
}
function upload2(element, fileOrFiles, options = {}) {
  return setupDirect(options).api.upload(element, fileOrFiles);
}
function tab2(options = {}) {
  return setupDirect().api.tab(options);
}

// node_modules/.pnpm/@testing-library+user-event@14.6.1_@testing-library+dom@10.4.1/node_modules/@testing-library/user-event/dist/esm/setup/index.js
var userEvent = {
  ...directApi_exports,
  setup: setupMain
};
export {
  PointerEventsCheckLevel,
  userEvent as default,
  userEvent
};
//# sourceMappingURL=@testing-library_user-event.js.map
