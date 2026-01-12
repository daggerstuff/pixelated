import "./chunk-PLDDJCW6.js";

// node_modules/.pnpm/node-seal@7.0.0/node_modules/node-seal/dist/seal_throws.js
async function Module(moduleArg = {}) {
  var moduleRtn;
  var Module2 = moduleArg;
  var ENVIRONMENT_IS_WEB = !!globalThis.window;
  var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;
  var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";
  if (ENVIRONMENT_IS_NODE) {
    const { createRequire } = await import("./module-QK64VTW3.js");
    var require2 = createRequire(import.meta.url);
  }
  var arguments_ = [];
  var thisProgram = "./this.program";
  var quit_ = (status, toThrow) => {
    throw toThrow;
  };
  var _scriptName = import.meta.url;
  var scriptDirectory = "";
  function locateFile(path) {
    if (Module2["locateFile"]) {
      return Module2["locateFile"](path, scriptDirectory);
    }
    return scriptDirectory + path;
  }
  var readAsync, readBinary;
  if (ENVIRONMENT_IS_NODE) {
    var fs = require2("fs");
    if (_scriptName.startsWith("file:")) {
      scriptDirectory = require2("path").dirname(require2("url").fileURLToPath(_scriptName)) + "/";
    }
    readBinary = (filename) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename);
      return ret;
    };
    readAsync = async (filename, binary = true) => {
      filename = isFileURI(filename) ? new URL(filename) : filename;
      var ret = fs.readFileSync(filename, binary ? void 0 : "utf8");
      return ret;
    };
    if (process.argv.length > 1) {
      thisProgram = process.argv[1].replace(/\\/g, "/");
    }
    arguments_ = process.argv.slice(2);
    quit_ = (status, toThrow) => {
      process.exitCode = status;
      throw toThrow;
    };
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    try {
      scriptDirectory = new URL(".", _scriptName).href;
    } catch {
    }
    {
      if (ENVIRONMENT_IS_WORKER) {
        readBinary = (url) => {
          var xhr = new XMLHttpRequest();
          xhr.open("GET", url, false);
          xhr.responseType = "arraybuffer";
          xhr.send(null);
          return new Uint8Array(
            /** @type{!ArrayBuffer} */
            xhr.response
          );
        };
      }
      readAsync = async (url) => {
        if (isFileURI(url)) {
          return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
              if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                resolve(xhr.response);
                return;
              }
              reject(xhr.status);
            };
            xhr.onerror = reject;
            xhr.send(null);
          });
        }
        var response = await fetch(url, { credentials: "same-origin" });
        if (response.ok) {
          return response.arrayBuffer();
        }
        throw new Error(response.status + " : " + response.url);
      };
    }
  } else {
  }
  var out = console.log.bind(console);
  var err = console.error.bind(console);
  var wasmBinary;
  var ABORT = false;
  var EXITSTATUS;
  var isFileURI = (filename) => filename.startsWith("file://");
  var readyPromiseResolve, readyPromiseReject;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var HEAP64, HEAPU64;
  var runtimeInitialized = false;
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    HEAP8 = new Int8Array(b);
    HEAP16 = new Int16Array(b);
    HEAPU8 = new Uint8Array(b);
    HEAPU16 = new Uint16Array(b);
    HEAP32 = new Int32Array(b);
    HEAPU32 = new Uint32Array(b);
    HEAPF32 = new Float32Array(b);
    HEAPF64 = new Float64Array(b);
    HEAP64 = new BigInt64Array(b);
    HEAPU64 = new BigUint64Array(b);
  }
  function preRun() {
    if (Module2["preRun"]) {
      if (typeof Module2["preRun"] == "function") Module2["preRun"] = [Module2["preRun"]];
      while (Module2["preRun"].length) {
        addOnPreRun(Module2["preRun"].shift());
      }
    }
    callRuntimeCallbacks(onPreRuns);
  }
  function initRuntime() {
    runtimeInitialized = true;
    wasmExports["S"]();
  }
  function postRun() {
    if (Module2["postRun"]) {
      if (typeof Module2["postRun"] == "function") Module2["postRun"] = [Module2["postRun"]];
      while (Module2["postRun"].length) {
        addOnPostRun(Module2["postRun"].shift());
      }
    }
    callRuntimeCallbacks(onPostRuns);
  }
  function abort(what) {
    Module2["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    if (runtimeInitialized) {
      ___trap();
    }
    var e = new WebAssembly.RuntimeError(what);
    readyPromiseReject?.(e);
    throw e;
  }
  var wasmBinaryFile;
  function findWasmBinary() {
    if (Module2["locateFile"]) {
      return locateFile("seal_throws.wasm");
    }
    return new URL("seal_throws.wasm", import.meta.url).href;
  }
  function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw "both async and sync fetching of the wasm failed";
  }
  async function getWasmBinary(binaryFile) {
    if (!wasmBinary) {
      try {
        var response = await readAsync(binaryFile);
        return new Uint8Array(response);
      } catch {
      }
    }
    return getBinarySync(binaryFile);
  }
  async function instantiateArrayBuffer(binaryFile, imports) {
    try {
      var binary = await getWasmBinary(binaryFile);
      var instance = await WebAssembly.instantiate(binary, imports);
      return instance;
    } catch (reason) {
      err(`failed to asynchronously prepare wasm: ${reason}`);
      abort(reason);
    }
  }
  async function instantiateAsync(binary, binaryFile, imports) {
    if (!binary && !isFileURI(binaryFile) && !ENVIRONMENT_IS_NODE) {
      try {
        var response = fetch(binaryFile, { credentials: "same-origin" });
        var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
        return instantiationResult;
      } catch (reason) {
        err(`wasm streaming compile failed: ${reason}`);
        err("falling back to ArrayBuffer instantiation");
      }
    }
    return instantiateArrayBuffer(binaryFile, imports);
  }
  function getWasmImports() {
    var imports = { "a": wasmImports };
    return imports;
  }
  async function createWasm() {
    function receiveInstance(instance, module) {
      wasmExports = instance.exports;
      wasmExports = applySignatureConversions(wasmExports);
      assignWasmExports(wasmExports);
      updateMemoryViews();
      return wasmExports;
    }
    function receiveInstantiationResult(result2) {
      return receiveInstance(result2["instance"]);
    }
    var info = getWasmImports();
    if (Module2["instantiateWasm"]) {
      return new Promise((resolve, reject) => {
        Module2["instantiateWasm"](info, (inst, mod) => {
          resolve(receiveInstance(inst, mod));
        });
      });
    }
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
    var exports = receiveInstantiationResult(result);
    return exports;
  }
  class ExitStatus {
    name = "ExitStatus";
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }
  var callRuntimeCallbacks = (callbacks) => {
    while (callbacks.length > 0) {
      callbacks.shift()(Module2);
    }
  };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);
  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);
  var noExitRuntime = true;
  var INT53_MAX = 9007199254740992;
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) => num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);
  var UTF8Decoder = globalThis.TextDecoder && new TextDecoder();
  var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
    var maxIdx = idx + maxBytesToRead;
    if (ignoreNul) return maxIdx;
    while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
    return idx;
  };
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
    idx >>>= 0;
    var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
      return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
    }
    var str = "";
    while (idx < endPtr) {
      var u0 = heapOrArray[idx++];
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      var u1 = heapOrArray[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode((u0 & 31) << 6 | u1);
        continue;
      }
      var u2 = heapOrArray[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
      } else {
        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
      }
    }
    return str;
  };
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
    ptr >>>= 0;
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "";
  };
  function ___assert_fail(condition, filename, line, func) {
    condition >>>= 0;
    filename >>>= 0;
    func >>>= 0;
    return abort(`Assertion failed: ${UTF8ToString(condition)}, at: ` + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"]);
  }
  var getCppExceptionTag = () => ___cpp_exception;
  var getCppExceptionThrownObjectFromWebAssemblyException = (ex) => {
    var unwind_header = ex.getArg(getCppExceptionTag(), 0);
    return ___thrown_object_from_unwind_exception(unwind_header);
  };
  var stackSave = () => _emscripten_stack_get_current();
  var stackRestore = (val) => __emscripten_stack_restore(val);
  var stackAlloc = (sz) => __emscripten_stack_alloc(sz);
  var getExceptionMessageCommon = (ptr) => {
    var sp = stackSave();
    var type_addr_addr = stackAlloc(4);
    var message_addr_addr = stackAlloc(4);
    ___get_exception_message(ptr, type_addr_addr, message_addr_addr);
    var type_addr = HEAPU32[type_addr_addr >>> 2 >>> 0];
    var message_addr = HEAPU32[message_addr_addr >>> 2 >>> 0];
    var type = UTF8ToString(type_addr);
    _free(type_addr);
    var message;
    if (message_addr) {
      message = UTF8ToString(message_addr);
      _free(message_addr);
    }
    stackRestore(sp);
    return [type, message];
  };
  var getExceptionMessage = (ex) => {
    var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
    return getExceptionMessageCommon(ptr);
  };
  var ___throw_exception_with_stack_trace = (ex) => {
    var e = new WebAssembly.Exception(getCppExceptionTag(), [ex], { traceStack: true });
    e.message = getExceptionMessage(e);
    throw e;
  };
  var __abort_js = () => abort("");
  var AsciiToString = (ptr) => {
    ptr >>>= 0;
    var str = "";
    while (1) {
      var ch = HEAPU8[ptr++ >>> 0];
      if (!ch) return str;
      str += String.fromCharCode(ch);
    }
  };
  var awaitingDependencies = {};
  var registeredTypes = {};
  var typeDependencies = {};
  var BindingError = class BindingError extends Error {
    constructor(message) {
      super(message);
      this.name = "BindingError";
    }
  };
  var throwBindingError = (message) => {
    throw new BindingError(message);
  };
  function sharedRegisterType(rawType, registeredInstance, options = {}) {
    var name = registeredInstance.name;
    if (!rawType) {
      throwBindingError(`type "${name}" must have a positive integer typeid pointer`);
    }
    if (registeredTypes.hasOwnProperty(rawType)) {
      if (options.ignoreDuplicateRegistrations) {
        return;
      } else {
        throwBindingError(`Cannot register type '${name}' twice`);
      }
    }
    registeredTypes[rawType] = registeredInstance;
    delete typeDependencies[rawType];
    if (awaitingDependencies.hasOwnProperty(rawType)) {
      var callbacks = awaitingDependencies[rawType];
      delete awaitingDependencies[rawType];
      callbacks.forEach((cb) => cb());
    }
  }
  function registerType(rawType, registeredInstance, options = {}) {
    return sharedRegisterType(rawType, registeredInstance, options);
  }
  var integerReadValueFromPointer = (name, width, signed) => {
    switch (width) {
      case 1:
        return signed ? (pointer) => HEAP8[pointer >>> 0] : (pointer) => HEAPU8[pointer >>> 0];
      case 2:
        return signed ? (pointer) => HEAP16[pointer >>> 1 >>> 0] : (pointer) => HEAPU16[pointer >>> 1 >>> 0];
      case 4:
        return signed ? (pointer) => HEAP32[pointer >>> 2 >>> 0] : (pointer) => HEAPU32[pointer >>> 2 >>> 0];
      case 8:
        return signed ? (pointer) => HEAP64[pointer >>> 3 >>> 0] : (pointer) => HEAPU64[pointer >>> 3 >>> 0];
      default:
        throw new TypeError(`invalid integer width (${width}): ${name}`);
    }
  };
  var __embind_register_bigint = function(primitiveType, name, size, minRange, maxRange) {
    primitiveType >>>= 0;
    name >>>= 0;
    size >>>= 0;
    name = AsciiToString(name);
    const isUnsignedType = minRange === 0n;
    let fromWireType = (value) => value;
    if (isUnsignedType) {
      const bitSize = size * 8;
      fromWireType = (value) => BigInt.asUintN(bitSize, value);
      maxRange = fromWireType(maxRange);
    }
    registerType(primitiveType, { name, fromWireType, toWireType: (destructors, value) => {
      if (typeof value == "number") {
        value = BigInt(value);
      }
      return value;
    }, readValueFromPointer: integerReadValueFromPointer(name, size, !isUnsignedType), destructorFunction: null });
  };
  function __embind_register_bool(rawType, name, trueValue, falseValue) {
    rawType >>>= 0;
    name >>>= 0;
    name = AsciiToString(name);
    registerType(rawType, { name, fromWireType: function(wt) {
      return !!wt;
    }, toWireType: function(destructors, o) {
      return o ? trueValue : falseValue;
    }, readValueFromPointer: function(pointer) {
      return this.fromWireType(HEAPU8[pointer >>> 0]);
    }, destructorFunction: null });
  }
  var shallowCopyInternalPointer = (o) => ({ count: o.count, deleteScheduled: o.deleteScheduled, preservePointerOnDelete: o.preservePointerOnDelete, ptr: o.ptr, ptrType: o.ptrType, smartPtr: o.smartPtr, smartPtrType: o.smartPtrType });
  var throwInstanceAlreadyDeleted = (obj) => {
    function getInstanceTypeName(handle) {
      return handle.$$.ptrType.registeredClass.name;
    }
    throwBindingError(getInstanceTypeName(obj) + " instance already deleted");
  };
  var finalizationRegistry = false;
  var detachFinalizer = (handle) => {
  };
  var runDestructor = ($$) => {
    if ($$.smartPtr) {
      $$.smartPtrType.rawDestructor($$.smartPtr);
    } else {
      $$.ptrType.registeredClass.rawDestructor($$.ptr);
    }
  };
  var releaseClassHandle = ($$) => {
    $$.count.value -= 1;
    var toDelete = 0 === $$.count.value;
    if (toDelete) {
      runDestructor($$);
    }
  };
  var attachFinalizer = (handle) => {
    if (!globalThis.FinalizationRegistry) {
      attachFinalizer = (handle2) => handle2;
      return handle;
    }
    finalizationRegistry = new FinalizationRegistry((info) => {
      releaseClassHandle(info.$$);
    });
    attachFinalizer = (handle2) => {
      var $$ = handle2.$$;
      var hasSmartPtr = !!$$.smartPtr;
      if (hasSmartPtr) {
        var info = { $$ };
        finalizationRegistry.register(handle2, info, handle2);
      }
      return handle2;
    };
    detachFinalizer = (handle2) => finalizationRegistry.unregister(handle2);
    return attachFinalizer(handle);
  };
  var deletionQueue = [];
  var flushPendingDeletes = () => {
    while (deletionQueue.length) {
      var obj = deletionQueue.pop();
      obj.$$.deleteScheduled = false;
      obj["delete"]();
    }
  };
  var delayFunction;
  var init_ClassHandle = () => {
    let proto = ClassHandle.prototype;
    Object.assign(proto, { "isAliasOf"(other) {
      if (!(this instanceof ClassHandle)) {
        return false;
      }
      if (!(other instanceof ClassHandle)) {
        return false;
      }
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      other.$$ = /** @type {Object} */
      other.$$;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
      while (leftClass.baseClass) {
        left = leftClass.upcast(left);
        leftClass = leftClass.baseClass;
      }
      while (rightClass.baseClass) {
        right = rightClass.upcast(right);
        rightClass = rightClass.baseClass;
      }
      return leftClass === rightClass && left === right;
    }, "clone"() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.preservePointerOnDelete) {
        this.$$.count.value += 1;
        return this;
      } else {
        var clone = attachFinalizer(Object.create(Object.getPrototypeOf(this), { $$: { value: shallowCopyInternalPointer(this.$$) } }));
        clone.$$.count.value += 1;
        clone.$$.deleteScheduled = false;
        return clone;
      }
    }, "delete"() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion");
      }
      detachFinalizer(this);
      releaseClassHandle(this.$$);
      if (!this.$$.preservePointerOnDelete) {
        this.$$.smartPtr = void 0;
        this.$$.ptr = void 0;
      }
    }, "isDeleted"() {
      return !this.$$.ptr;
    }, "deleteLater"() {
      if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError("Object already scheduled for deletion");
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
        delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    } });
    const symbolDispose = Symbol.dispose;
    if (symbolDispose) {
      proto[symbolDispose] = proto["delete"];
    }
  };
  function ClassHandle() {
  }
  var createNamedFunction = (name, func) => Object.defineProperty(func, "name", { value: name });
  var registeredPointers = {};
  var ensureOverloadTable = (proto, methodName, humanName) => {
    if (void 0 === proto[methodName].overloadTable) {
      var prevFunc = proto[methodName];
      proto[methodName] = function(...args) {
        if (!proto[methodName].overloadTable.hasOwnProperty(args.length)) {
          throwBindingError(`Function '${humanName}' called with an invalid number of arguments (${args.length}) - expects one of (${proto[methodName].overloadTable})!`);
        }
        return proto[methodName].overloadTable[args.length].apply(this, args);
      };
      proto[methodName].overloadTable = [];
      proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
    }
  };
  var exposePublicSymbol = (name, value, numArguments) => {
    if (Module2.hasOwnProperty(name)) {
      if (void 0 === numArguments || void 0 !== Module2[name].overloadTable && void 0 !== Module2[name].overloadTable[numArguments]) {
        throwBindingError(`Cannot register public name '${name}' twice`);
      }
      ensureOverloadTable(Module2, name, name);
      if (Module2[name].overloadTable.hasOwnProperty(numArguments)) {
        throwBindingError(`Cannot register multiple overloads of a function with the same number of arguments (${numArguments})!`);
      }
      Module2[name].overloadTable[numArguments] = value;
    } else {
      Module2[name] = value;
      Module2[name].argCount = numArguments;
    }
  };
  var char_0 = 48;
  var char_9 = 57;
  var makeLegalFunctionName = (name) => {
    name = name.replace(/[^a-zA-Z0-9_]/g, "$");
    var f = name.charCodeAt(0);
    if (f >= char_0 && f <= char_9) {
      return `_${name}`;
    }
    return name;
  };
  function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
    this.name = name;
    this.constructor = constructor;
    this.instancePrototype = instancePrototype;
    this.rawDestructor = rawDestructor;
    this.baseClass = baseClass;
    this.getActualType = getActualType;
    this.upcast = upcast;
    this.downcast = downcast;
    this.pureVirtualFunctions = [];
  }
  var upcastPointer = (ptr, ptrClass, desiredClass) => {
    while (ptrClass !== desiredClass) {
      if (!ptrClass.upcast) {
        throwBindingError(`Expected null or instance of ${desiredClass.name}, got an instance of ${ptrClass.name}`);
      }
      ptr = ptrClass.upcast(ptr);
      ptrClass = ptrClass.baseClass;
    }
    return ptr;
  };
  var embindRepr = (v) => {
    if (v === null) {
      return "null";
    }
    var t = typeof v;
    if (t === "object" || t === "array" || t === "function") {
      return v.toString();
    } else {
      return "" + v;
    }
  };
  function constNoSmartPtrRawPointerToWireType(destructors, handle) {
    if (handle === null) {
      if (this.isReference) {
        throwBindingError(`null is not a valid ${this.name}`);
      }
      return 0;
    }
    if (!handle.$$) {
      throwBindingError(`Cannot pass "${embindRepr(handle)}" as a ${this.name}`);
    }
    if (!handle.$$.ptr) {
      throwBindingError(`Cannot pass deleted object as a pointer of type ${this.name}`);
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    return ptr;
  }
  function genericPointerToWireType(destructors, handle) {
    var ptr;
    if (handle === null) {
      if (this.isReference) {
        throwBindingError(`null is not a valid ${this.name}`);
      }
      if (this.isSmartPointer) {
        ptr = this.rawConstructor();
        if (destructors !== null) {
          destructors.push(this.rawDestructor, ptr);
        }
        return ptr;
      } else {
        return 0;
      }
    }
    if (!handle || !handle.$$) {
      throwBindingError(`Cannot pass "${embindRepr(handle)}" as a ${this.name}`);
    }
    if (!handle.$$.ptr) {
      throwBindingError(`Cannot pass deleted object as a pointer of type ${this.name}`);
    }
    if (!this.isConst && handle.$$.ptrType.isConst) {
      throwBindingError(`Cannot convert argument of type ${handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name} to parameter type ${this.name}`);
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    if (this.isSmartPointer) {
      if (void 0 === handle.$$.smartPtr) {
        throwBindingError("Passing raw pointer to smart pointer is illegal");
      }
      switch (this.sharingPolicy) {
        case 0:
          if (handle.$$.smartPtrType === this) {
            ptr = handle.$$.smartPtr;
          } else {
            throwBindingError(`Cannot convert argument of type ${handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name} to parameter type ${this.name}`);
          }
          break;
        case 1:
          ptr = handle.$$.smartPtr;
          break;
        case 2:
          if (handle.$$.smartPtrType === this) {
            ptr = handle.$$.smartPtr;
          } else {
            var clonedHandle = handle["clone"]();
            ptr = this.rawShare(ptr, Emval.toHandle(() => clonedHandle["delete"]()));
            if (destructors !== null) {
              destructors.push(this.rawDestructor, ptr);
            }
          }
          break;
        default:
          throwBindingError("Unsupporting sharing policy");
      }
    }
    return ptr;
  }
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
    if (handle === null) {
      if (this.isReference) {
        throwBindingError(`null is not a valid ${this.name}`);
      }
      return 0;
    }
    if (!handle.$$) {
      throwBindingError(`Cannot pass "${embindRepr(handle)}" as a ${this.name}`);
    }
    if (!handle.$$.ptr) {
      throwBindingError(`Cannot pass deleted object as a pointer of type ${this.name}`);
    }
    if (handle.$$.ptrType.isConst) {
      throwBindingError(`Cannot convert argument of type ${handle.$$.ptrType.name} to parameter type ${this.name}`);
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    return ptr;
  }
  function readPointer(pointer) {
    return this.fromWireType(HEAPU32[pointer >>> 2 >>> 0]);
  }
  var downcastPointer = (ptr, ptrClass, desiredClass) => {
    if (ptrClass === desiredClass) {
      return ptr;
    }
    if (void 0 === desiredClass.baseClass) {
      return null;
    }
    var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
    if (rv === null) {
      return null;
    }
    return desiredClass.downcast(rv);
  };
  var registeredInstances = {};
  var getBasestPointer = (class_, ptr) => {
    if (ptr === void 0) {
      throwBindingError("ptr should not be undefined");
    }
    while (class_.baseClass) {
      ptr = class_.upcast(ptr);
      class_ = class_.baseClass;
    }
    return ptr;
  };
  var getInheritedInstance = (class_, ptr) => {
    ptr = getBasestPointer(class_, ptr);
    return registeredInstances[ptr];
  };
  var InternalError = class InternalError extends Error {
    constructor(message) {
      super(message);
      this.name = "InternalError";
    }
  };
  var throwInternalError = (message) => {
    throw new InternalError(message);
  };
  var makeClassHandle = (prototype, record) => {
    if (!record.ptrType || !record.ptr) {
      throwInternalError("makeClassHandle requires ptr and ptrType");
    }
    var hasSmartPtrType = !!record.smartPtrType;
    var hasSmartPtr = !!record.smartPtr;
    if (hasSmartPtrType !== hasSmartPtr) {
      throwInternalError("Both smartPtrType and smartPtr must be specified");
    }
    record.count = { value: 1 };
    return attachFinalizer(Object.create(prototype, { $$: { value: record, writable: true } }));
  };
  function RegisteredPointer_fromWireType(ptr) {
    var rawPointer = this.getPointee(ptr);
    if (!rawPointer) {
      this.destructor(ptr);
      return null;
    }
    var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
    if (void 0 !== registeredInstance) {
      if (0 === registeredInstance.$$.count.value) {
        registeredInstance.$$.ptr = rawPointer;
        registeredInstance.$$.smartPtr = ptr;
        return registeredInstance["clone"]();
      } else {
        var rv = registeredInstance["clone"]();
        this.destructor(ptr);
        return rv;
      }
    }
    function makeDefaultHandle() {
      if (this.isSmartPointer) {
        return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this.pointeeType, ptr: rawPointer, smartPtrType: this, smartPtr: ptr });
      } else {
        return makeClassHandle(this.registeredClass.instancePrototype, { ptrType: this, ptr });
      }
    }
    var actualType = this.registeredClass.getActualType(rawPointer);
    var registeredPointerRecord = registeredPointers[actualType];
    if (!registeredPointerRecord) {
      return makeDefaultHandle.call(this);
    }
    var toType;
    if (this.isConst) {
      toType = registeredPointerRecord.constPointerType;
    } else {
      toType = registeredPointerRecord.pointerType;
    }
    var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
    if (dp === null) {
      return makeDefaultHandle.call(this);
    }
    if (this.isSmartPointer) {
      return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp, smartPtrType: this, smartPtr: ptr });
    } else {
      return makeClassHandle(toType.registeredClass.instancePrototype, { ptrType: toType, ptr: dp });
    }
  }
  var init_RegisteredPointer = () => {
    Object.assign(RegisteredPointer.prototype, { getPointee(ptr) {
      if (this.rawGetPointee) {
        ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }, destructor(ptr) {
      this.rawDestructor?.(ptr);
    }, readValueFromPointer: readPointer, fromWireType: RegisteredPointer_fromWireType });
  };
  function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
    this.name = name;
    this.registeredClass = registeredClass;
    this.isReference = isReference;
    this.isConst = isConst;
    this.isSmartPointer = isSmartPointer;
    this.pointeeType = pointeeType;
    this.sharingPolicy = sharingPolicy;
    this.rawGetPointee = rawGetPointee;
    this.rawConstructor = rawConstructor;
    this.rawShare = rawShare;
    this.rawDestructor = rawDestructor;
    if (!isSmartPointer && registeredClass.baseClass === void 0) {
      if (isConst) {
        this.toWireType = constNoSmartPtrRawPointerToWireType;
        this.destructorFunction = null;
      } else {
        this.toWireType = nonConstNoSmartPtrRawPointerToWireType;
        this.destructorFunction = null;
      }
    } else {
      this.toWireType = genericPointerToWireType;
    }
  }
  var replacePublicSymbol = (name, value, numArguments) => {
    if (!Module2.hasOwnProperty(name)) {
      throwInternalError("Replacing nonexistent public symbol");
    }
    if (void 0 !== Module2[name].overloadTable && void 0 !== numArguments) {
      Module2[name].overloadTable[numArguments] = value;
    } else {
      Module2[name] = value;
      Module2[name].argCount = numArguments;
    }
  };
  var wasmTableMirror = [];
  var getWasmTableEntry = (funcPtr) => {
    var func = wasmTableMirror[funcPtr];
    if (!func) {
      wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
    }
    return func;
  };
  var dynCall = (sig, ptr, args = [], promising = false) => {
    var func = getWasmTableEntry(ptr);
    var rtn = func(...args);
    function convert(rtn2) {
      return sig[0] == "p" ? rtn2 >>> 0 : rtn2;
    }
    return convert(rtn);
  };
  var getDynCaller = (sig, ptr, promising = false) => (...args) => dynCall(sig, ptr, args, promising);
  var embind__requireFunction = (signature, rawFunction, isAsync = false) => {
    signature = AsciiToString(signature);
    function makeDynCaller() {
      if (signature.includes("p")) {
        return getDynCaller(signature, rawFunction, isAsync);
      }
      var rtn = getWasmTableEntry(rawFunction);
      return rtn;
    }
    var fp = makeDynCaller();
    if (typeof fp != "function") {
      throwBindingError(`unknown function pointer with signature ${signature}: ${rawFunction}`);
    }
    return fp;
  };
  class UnboundTypeError extends Error {
  }
  var getTypeName = (type) => {
    var ptr = ___getTypeName(type);
    var rv = AsciiToString(ptr);
    _free(ptr);
    return rv;
  };
  var throwUnboundTypeError = (message, types) => {
    var unboundTypes = [];
    var seen = {};
    function visit(type) {
      if (seen[type]) {
        return;
      }
      if (registeredTypes[type]) {
        return;
      }
      if (typeDependencies[type]) {
        typeDependencies[type].forEach(visit);
        return;
      }
      unboundTypes.push(type);
      seen[type] = true;
    }
    types.forEach(visit);
    throw new UnboundTypeError(`${message}: ` + unboundTypes.map(getTypeName).join([", "]));
  };
  var whenDependentTypesAreResolved = (myTypes, dependentTypes, getTypeConverters) => {
    myTypes.forEach((type) => typeDependencies[type] = dependentTypes);
    function onComplete(typeConverters2) {
      var myTypeConverters = getTypeConverters(typeConverters2);
      if (myTypeConverters.length !== myTypes.length) {
        throwInternalError("Mismatched type converter count");
      }
      for (var i = 0; i < myTypes.length; ++i) {
        registerType(myTypes[i], myTypeConverters[i]);
      }
    }
    var typeConverters = new Array(dependentTypes.length);
    var unregisteredTypes = [];
    var registered = 0;
    for (let [i, dt] of dependentTypes.entries()) {
      if (registeredTypes.hasOwnProperty(dt)) {
        typeConverters[i] = registeredTypes[dt];
      } else {
        unregisteredTypes.push(dt);
        if (!awaitingDependencies.hasOwnProperty(dt)) {
          awaitingDependencies[dt] = [];
        }
        awaitingDependencies[dt].push(() => {
          typeConverters[i] = registeredTypes[dt];
          ++registered;
          if (registered === unregisteredTypes.length) {
            onComplete(typeConverters);
          }
        });
      }
    }
    if (0 === unregisteredTypes.length) {
      onComplete(typeConverters);
    }
  };
  function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
    rawType >>>= 0;
    rawPointerType >>>= 0;
    rawConstPointerType >>>= 0;
    baseClassRawType >>>= 0;
    getActualTypeSignature >>>= 0;
    getActualType >>>= 0;
    upcastSignature >>>= 0;
    upcast >>>= 0;
    downcastSignature >>>= 0;
    downcast >>>= 0;
    name >>>= 0;
    destructorSignature >>>= 0;
    rawDestructor >>>= 0;
    name = AsciiToString(name);
    getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
    upcast &&= embind__requireFunction(upcastSignature, upcast);
    downcast &&= embind__requireFunction(downcastSignature, downcast);
    rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
    var legalFunctionName = makeLegalFunctionName(name);
    exposePublicSymbol(legalFunctionName, function() {
      throwUnboundTypeError(`Cannot construct ${name} due to unbound types`, [baseClassRawType]);
    });
    whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], (base) => {
      base = base[0];
      var baseClass;
      var basePrototype;
      if (baseClassRawType) {
        baseClass = base.registeredClass;
        basePrototype = baseClass.instancePrototype;
      } else {
        basePrototype = ClassHandle.prototype;
      }
      var constructor = createNamedFunction(name, function(...args) {
        if (Object.getPrototypeOf(this) !== instancePrototype) {
          throw new BindingError(`Use 'new' to construct ${name}`);
        }
        if (void 0 === registeredClass.constructor_body) {
          throw new BindingError(`${name} has no accessible constructor`);
        }
        var body = registeredClass.constructor_body[args.length];
        if (void 0 === body) {
          throw new BindingError(`Tried to invoke ctor of ${name} with invalid number of parameters (${args.length}) - expected (${Object.keys(registeredClass.constructor_body).toString()}) parameters instead!`);
        }
        return body.apply(this, args);
      });
      var instancePrototype = Object.create(basePrototype, { constructor: { value: constructor } });
      constructor.prototype = instancePrototype;
      var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
      if (registeredClass.baseClass) {
        registeredClass.baseClass.__derivedClasses ??= [];
        registeredClass.baseClass.__derivedClasses.push(registeredClass);
      }
      var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
      var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
      var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
      registeredPointers[rawType] = { pointerType: pointerConverter, constPointerType: constPointerConverter };
      replacePublicSymbol(legalFunctionName, constructor);
      return [referenceConverter, pointerConverter, constPointerConverter];
    });
  }
  var runDestructors = (destructors) => {
    while (destructors.length) {
      var ptr = destructors.pop();
      var del = destructors.pop();
      del(ptr);
    }
  };
  function usesDestructorStack(argTypes) {
    for (var i = 1; i < argTypes.length; ++i) {
      if (argTypes[i] !== null && argTypes[i].destructorFunction === void 0) {
        return true;
      }
    }
    return false;
  }
  function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc, isAsync) {
    var argCount = argTypes.length;
    if (argCount < 2) {
      throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
    }
    var isClassMethodFunc = argTypes[1] !== null && classType !== null;
    var needsDestructorStack = usesDestructorStack(argTypes);
    var returns = !argTypes[0].isVoid;
    var expectedArgCount = argCount - 2;
    var argsWired = new Array(expectedArgCount);
    var invokerFuncArgs = [];
    var destructors = [];
    var invokerFn = function(...args) {
      destructors.length = 0;
      var thisWired;
      invokerFuncArgs.length = isClassMethodFunc ? 2 : 1;
      invokerFuncArgs[0] = cppTargetFunc;
      if (isClassMethodFunc) {
        thisWired = argTypes[1].toWireType(destructors, this);
        invokerFuncArgs[1] = thisWired;
      }
      for (var i = 0; i < expectedArgCount; ++i) {
        argsWired[i] = argTypes[i + 2].toWireType(destructors, args[i]);
        invokerFuncArgs.push(argsWired[i]);
      }
      var rv = cppInvokerFunc(...invokerFuncArgs);
      function onDone(rv2) {
        if (needsDestructorStack) {
          runDestructors(destructors);
        } else {
          for (var i2 = isClassMethodFunc ? 1 : 2; i2 < argTypes.length; i2++) {
            var param = i2 === 1 ? thisWired : argsWired[i2 - 2];
            if (argTypes[i2].destructorFunction !== null) {
              argTypes[i2].destructorFunction(param);
            }
          }
        }
        if (returns) {
          return argTypes[0].fromWireType(rv2);
        }
      }
      return onDone(rv);
    };
    return createNamedFunction(humanName, invokerFn);
  }
  var heap32VectorToArray = (count, firstElement) => {
    var array = [];
    for (var i = 0; i < count; i++) {
      array.push(HEAPU32[firstElement + i * 4 >>> 2 >>> 0]);
    }
    return array;
  };
  var getFunctionName = (signature) => {
    signature = signature.trim();
    const argsIndex = signature.indexOf("(");
    if (argsIndex === -1) return signature;
    return signature.slice(0, argsIndex);
  };
  var __embind_register_class_class_function = function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, fn, isAsync, isNonnullReturn) {
    rawClassType >>>= 0;
    methodName >>>= 0;
    rawArgTypesAddr >>>= 0;
    invokerSignature >>>= 0;
    rawInvoker >>>= 0;
    fn >>>= 0;
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    methodName = AsciiToString(methodName);
    methodName = getFunctionName(methodName);
    rawInvoker = embind__requireFunction(invokerSignature, rawInvoker, isAsync);
    whenDependentTypesAreResolved([], [rawClassType], (classType) => {
      classType = classType[0];
      var humanName = `${classType.name}.${methodName}`;
      function unboundTypesHandler() {
        throwUnboundTypeError(`Cannot call ${humanName} due to unbound types`, rawArgTypes);
      }
      if (methodName.startsWith("@@")) {
        methodName = Symbol[methodName.substring(2)];
      }
      var proto = classType.registeredClass.constructor;
      if (void 0 === proto[methodName]) {
        unboundTypesHandler.argCount = argCount - 1;
        proto[methodName] = unboundTypesHandler;
      } else {
        ensureOverloadTable(proto, methodName, humanName);
        proto[methodName].overloadTable[argCount - 1] = unboundTypesHandler;
      }
      whenDependentTypesAreResolved([], rawArgTypes, (argTypes) => {
        var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
        var func = craftInvokerFunction(humanName, invokerArgsArray, null, rawInvoker, fn, isAsync);
        if (void 0 === proto[methodName].overloadTable) {
          func.argCount = argCount - 1;
          proto[methodName] = func;
        } else {
          proto[methodName].overloadTable[argCount - 1] = func;
        }
        if (classType.registeredClass.__derivedClasses) {
          for (const derivedClass of classType.registeredClass.__derivedClasses) {
            if (!derivedClass.constructor.hasOwnProperty(methodName)) {
              derivedClass.constructor[methodName] = func;
            }
          }
        }
        return [];
      });
      return [];
    });
  };
  var __embind_register_class_class_property = function(rawClassType, fieldName, rawFieldType, rawFieldPtr, getterSignature, getter, setterSignature, setter) {
    rawClassType >>>= 0;
    fieldName >>>= 0;
    rawFieldType >>>= 0;
    rawFieldPtr >>>= 0;
    getterSignature >>>= 0;
    getter >>>= 0;
    setterSignature >>>= 0;
    setter >>>= 0;
    fieldName = AsciiToString(fieldName);
    getter = embind__requireFunction(getterSignature, getter);
    whenDependentTypesAreResolved([], [rawClassType], (classType) => {
      classType = classType[0];
      var humanName = `${classType.name}.${fieldName}`;
      var desc = { get() {
        throwUnboundTypeError(`Cannot access ${humanName} due to unbound types`, [rawFieldType]);
      }, enumerable: true, configurable: true };
      if (setter) {
        desc.set = () => {
          throwUnboundTypeError(`Cannot access ${humanName} due to unbound types`, [rawFieldType]);
        };
      } else {
        desc.set = (v) => {
          throwBindingError(`${humanName} is a read-only property`);
        };
      }
      Object.defineProperty(classType.registeredClass.constructor, fieldName, desc);
      whenDependentTypesAreResolved([], [rawFieldType], (fieldType) => {
        fieldType = fieldType[0];
        var desc2 = { get() {
          return fieldType.fromWireType(getter(rawFieldPtr));
        }, enumerable: true };
        if (setter) {
          setter = embind__requireFunction(setterSignature, setter);
          desc2.set = (v) => {
            var destructors = [];
            setter(rawFieldPtr, fieldType.toWireType(destructors, v));
            runDestructors(destructors);
          };
        }
        Object.defineProperty(classType.registeredClass.constructor, fieldName, desc2);
        return [];
      });
      return [];
    });
  };
  var __embind_register_class_constructor = function(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
    rawClassType >>>= 0;
    rawArgTypesAddr >>>= 0;
    invokerSignature >>>= 0;
    invoker >>>= 0;
    rawConstructor >>>= 0;
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    invoker = embind__requireFunction(invokerSignature, invoker);
    whenDependentTypesAreResolved([], [rawClassType], (classType) => {
      classType = classType[0];
      var humanName = `constructor ${classType.name}`;
      if (void 0 === classType.registeredClass.constructor_body) {
        classType.registeredClass.constructor_body = [];
      }
      if (void 0 !== classType.registeredClass.constructor_body[argCount - 1]) {
        throw new BindingError(`Cannot register multiple constructors with identical number of parameters (${argCount - 1}) for class '${classType.name}'! Overload resolution is currently only performed using the parameter count, not actual type info!`);
      }
      classType.registeredClass.constructor_body[argCount - 1] = () => {
        throwUnboundTypeError(`Cannot construct ${classType.name} due to unbound types`, rawArgTypes);
      };
      whenDependentTypesAreResolved([], rawArgTypes, (argTypes) => {
        argTypes.splice(1, 0, null);
        classType.registeredClass.constructor_body[argCount - 1] = craftInvokerFunction(humanName, argTypes, null, invoker, rawConstructor);
        return [];
      });
      return [];
    });
  };
  var __embind_register_class_function = function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual, isAsync, isNonnullReturn) {
    rawClassType >>>= 0;
    methodName >>>= 0;
    rawArgTypesAddr >>>= 0;
    invokerSignature >>>= 0;
    rawInvoker >>>= 0;
    context >>>= 0;
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    methodName = AsciiToString(methodName);
    methodName = getFunctionName(methodName);
    rawInvoker = embind__requireFunction(invokerSignature, rawInvoker, isAsync);
    whenDependentTypesAreResolved([], [rawClassType], (classType) => {
      classType = classType[0];
      var humanName = `${classType.name}.${methodName}`;
      if (methodName.startsWith("@@")) {
        methodName = Symbol[methodName.substring(2)];
      }
      if (isPureVirtual) {
        classType.registeredClass.pureVirtualFunctions.push(methodName);
      }
      function unboundTypesHandler() {
        throwUnboundTypeError(`Cannot call ${humanName} due to unbound types`, rawArgTypes);
      }
      var proto = classType.registeredClass.instancePrototype;
      var method = proto[methodName];
      if (void 0 === method || void 0 === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
        unboundTypesHandler.argCount = argCount - 2;
        unboundTypesHandler.className = classType.name;
        proto[methodName] = unboundTypesHandler;
      } else {
        ensureOverloadTable(proto, methodName, humanName);
        proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
      }
      whenDependentTypesAreResolved([], rawArgTypes, (argTypes) => {
        var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context, isAsync);
        if (void 0 === proto[methodName].overloadTable) {
          memberFunction.argCount = argCount - 2;
          proto[methodName] = memberFunction;
        } else {
          proto[methodName].overloadTable[argCount - 2] = memberFunction;
        }
        return [];
      });
      return [];
    });
  };
  var validateThis = (this_, classType, humanName) => {
    if (!(this_ instanceof Object)) {
      throwBindingError(`${humanName} with invalid "this": ${this_}`);
    }
    if (!(this_ instanceof classType.registeredClass.constructor)) {
      throwBindingError(`${humanName} incompatible with "this" of type ${this_.constructor.name}`);
    }
    if (!this_.$$.ptr) {
      throwBindingError(`cannot call emscripten binding method ${humanName} on deleted object`);
    }
    return upcastPointer(this_.$$.ptr, this_.$$.ptrType.registeredClass, classType.registeredClass);
  };
  var __embind_register_class_property = function(classType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
    classType >>>= 0;
    fieldName >>>= 0;
    getterReturnType >>>= 0;
    getterSignature >>>= 0;
    getter >>>= 0;
    getterContext >>>= 0;
    setterArgumentType >>>= 0;
    setterSignature >>>= 0;
    setter >>>= 0;
    setterContext >>>= 0;
    fieldName = AsciiToString(fieldName);
    getter = embind__requireFunction(getterSignature, getter);
    whenDependentTypesAreResolved([], [classType], (classType2) => {
      classType2 = classType2[0];
      var humanName = `${classType2.name}.${fieldName}`;
      var desc = { get() {
        throwUnboundTypeError(`Cannot access ${humanName} due to unbound types`, [getterReturnType, setterArgumentType]);
      }, enumerable: true, configurable: true };
      if (setter) {
        desc.set = () => throwUnboundTypeError(`Cannot access ${humanName} due to unbound types`, [getterReturnType, setterArgumentType]);
      } else {
        desc.set = (v) => throwBindingError(humanName + " is a read-only property");
      }
      Object.defineProperty(classType2.registeredClass.instancePrototype, fieldName, desc);
      whenDependentTypesAreResolved([], setter ? [getterReturnType, setterArgumentType] : [getterReturnType], (types) => {
        var getterReturnType2 = types[0];
        var desc2 = { get() {
          var ptr = validateThis(this, classType2, humanName + " getter");
          return getterReturnType2.fromWireType(getter(getterContext, ptr));
        }, enumerable: true };
        if (setter) {
          setter = embind__requireFunction(setterSignature, setter);
          var setterArgumentType2 = types[1];
          desc2.set = function(v) {
            var ptr = validateThis(this, classType2, humanName + " setter");
            var destructors = [];
            setter(setterContext, ptr, setterArgumentType2.toWireType(destructors, v));
            runDestructors(destructors);
          };
        }
        Object.defineProperty(classType2.registeredClass.instancePrototype, fieldName, desc2);
        return [];
      });
      return [];
    });
  };
  var emval_freelist = [];
  var emval_handles = [0, 1, , 1, null, 1, true, 1, false, 1];
  function __emval_decref(handle) {
    handle >>>= 0;
    if (handle > 9 && 0 === --emval_handles[handle + 1]) {
      emval_handles[handle] = void 0;
      emval_freelist.push(handle);
    }
  }
  var Emval = { toValue: (handle) => {
    if (!handle) {
      throwBindingError(`Cannot use deleted val. handle = ${handle}`);
    }
    return emval_handles[handle];
  }, toHandle: (value) => {
    switch (value) {
      case void 0:
        return 2;
      case null:
        return 4;
      case true:
        return 6;
      case false:
        return 8;
      default: {
        const handle = emval_freelist.pop() || emval_handles.length;
        emval_handles[handle] = value;
        emval_handles[handle + 1] = 1;
        return handle;
      }
    }
  } };
  var EmValType = { name: "emscripten::val", fromWireType: (handle) => {
    var rv = Emval.toValue(handle);
    __emval_decref(handle);
    return rv;
  }, toWireType: (destructors, value) => Emval.toHandle(value), readValueFromPointer: readPointer, destructorFunction: null };
  function __embind_register_emval(rawType) {
    rawType >>>= 0;
    return registerType(rawType, EmValType);
  }
  var enumReadValueFromPointer = (name, width, signed) => {
    switch (width) {
      case 1:
        return signed ? function(pointer) {
          return this.fromWireType(HEAP8[pointer >>> 0]);
        } : function(pointer) {
          return this.fromWireType(HEAPU8[pointer >>> 0]);
        };
      case 2:
        return signed ? function(pointer) {
          return this.fromWireType(HEAP16[pointer >>> 1 >>> 0]);
        } : function(pointer) {
          return this.fromWireType(HEAPU16[pointer >>> 1 >>> 0]);
        };
      case 4:
        return signed ? function(pointer) {
          return this.fromWireType(HEAP32[pointer >>> 2 >>> 0]);
        } : function(pointer) {
          return this.fromWireType(HEAPU32[pointer >>> 2 >>> 0]);
        };
      default:
        throw new TypeError(`invalid integer width (${width}): ${name}`);
    }
  };
  function __embind_register_enum(rawType, name, size, isSigned) {
    rawType >>>= 0;
    name >>>= 0;
    size >>>= 0;
    name = AsciiToString(name);
    function ctor() {
    }
    ctor.values = {};
    registerType(rawType, { name, constructor: ctor, fromWireType: function(c) {
      return this.constructor.values[c];
    }, toWireType: (destructors, c) => c.value, readValueFromPointer: enumReadValueFromPointer(name, size, isSigned), destructorFunction: null });
    exposePublicSymbol(name, ctor);
  }
  var requireRegisteredType = (rawType, humanName) => {
    var impl = registeredTypes[rawType];
    if (void 0 === impl) {
      throwBindingError(`${humanName} has unknown type ${getTypeName(rawType)}`);
    }
    return impl;
  };
  function __embind_register_enum_value(rawEnumType, name, enumValue) {
    rawEnumType >>>= 0;
    name >>>= 0;
    var enumType = requireRegisteredType(rawEnumType, "enum");
    name = AsciiToString(name);
    var Enum = enumType.constructor;
    var Value = Object.create(enumType.constructor.prototype, { value: { value: enumValue }, constructor: { value: createNamedFunction(`${enumType.name}_${name}`, function() {
    }) } });
    Enum.values[enumValue] = Value;
    Enum[name] = Value;
  }
  var floatReadValueFromPointer = (name, width) => {
    switch (width) {
      case 4:
        return function(pointer) {
          return this.fromWireType(HEAPF32[pointer >>> 2 >>> 0]);
        };
      case 8:
        return function(pointer) {
          return this.fromWireType(HEAPF64[pointer >>> 3 >>> 0]);
        };
      default:
        throw new TypeError(`invalid float width (${width}): ${name}`);
    }
  };
  var __embind_register_float = function(rawType, name, size) {
    rawType >>>= 0;
    name >>>= 0;
    size >>>= 0;
    name = AsciiToString(name);
    registerType(rawType, { name, fromWireType: (value) => value, toWireType: (destructors, value) => value, readValueFromPointer: floatReadValueFromPointer(name, size), destructorFunction: null });
  };
  function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn, isAsync, isNonnullReturn) {
    name >>>= 0;
    rawArgTypesAddr >>>= 0;
    signature >>>= 0;
    rawInvoker >>>= 0;
    fn >>>= 0;
    var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    name = AsciiToString(name);
    name = getFunctionName(name);
    rawInvoker = embind__requireFunction(signature, rawInvoker, isAsync);
    exposePublicSymbol(name, function() {
      throwUnboundTypeError(`Cannot call ${name} due to unbound types`, argTypes);
    }, argCount - 1);
    whenDependentTypesAreResolved([], argTypes, (argTypes2) => {
      var invokerArgsArray = [argTypes2[0], null].concat(argTypes2.slice(1));
      replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn, isAsync), argCount - 1);
      return [];
    });
  }
  var __embind_register_integer = function(primitiveType, name, size, minRange, maxRange) {
    primitiveType >>>= 0;
    name >>>= 0;
    size >>>= 0;
    name = AsciiToString(name);
    const isUnsignedType = minRange === 0;
    let fromWireType = (value) => value;
    if (isUnsignedType) {
      var bitshift = 32 - 8 * size;
      fromWireType = (value) => value << bitshift >>> bitshift;
      maxRange = fromWireType(maxRange);
    }
    registerType(primitiveType, { name, fromWireType, toWireType: (destructors, value) => value, readValueFromPointer: integerReadValueFromPointer(name, size, minRange !== 0), destructorFunction: null });
  };
  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
    rawType >>>= 0;
    name >>>= 0;
    var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array];
    var TA = typeMapping[dataTypeIndex];
    function decodeMemoryView(handle) {
      var size = HEAPU32[handle >>> 2 >>> 0];
      var data = HEAPU32[handle + 4 >>> 2 >>> 0];
      return new TA(HEAP8.buffer, data, size);
    }
    name = AsciiToString(name);
    registerType(rawType, { name, fromWireType: decodeMemoryView, readValueFromPointer: decodeMemoryView }, { ignoreDuplicateRegistrations: true });
  }
  var EmValOptionalType = Object.assign({ optional: true }, EmValType);
  function __embind_register_optional(rawOptionalType, rawType) {
    rawOptionalType >>>= 0;
    rawType >>>= 0;
    registerType(rawOptionalType, EmValOptionalType);
  }
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
    outIdx >>>= 0;
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
      var u = str.codePointAt(i);
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        heap[outIdx++ >>> 0] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        heap[outIdx++ >>> 0] = 192 | u >> 6;
        heap[outIdx++ >>> 0] = 128 | u & 63;
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        heap[outIdx++ >>> 0] = 224 | u >> 12;
        heap[outIdx++ >>> 0] = 128 | u >> 6 & 63;
        heap[outIdx++ >>> 0] = 128 | u & 63;
      } else {
        if (outIdx + 3 >= endIdx) break;
        heap[outIdx++ >>> 0] = 240 | u >> 18;
        heap[outIdx++ >>> 0] = 128 | u >> 12 & 63;
        heap[outIdx++ >>> 0] = 128 | u >> 6 & 63;
        heap[outIdx++ >>> 0] = 128 | u & 63;
        i++;
      }
    }
    heap[outIdx >>> 0] = 0;
    return outIdx - startIdx;
  };
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) => stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  var lengthBytesUTF8 = (str) => {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var c = str.charCodeAt(i);
      if (c <= 127) {
        len++;
      } else if (c <= 2047) {
        len += 2;
      } else if (c >= 55296 && c <= 57343) {
        len += 4;
        ++i;
      } else {
        len += 3;
      }
    }
    return len;
  };
  function __embind_register_std_string(rawType, name) {
    rawType >>>= 0;
    name >>>= 0;
    name = AsciiToString(name);
    var stdStringIsUTF8 = true;
    registerType(rawType, {
      name,
      // For some method names we use string keys here since they are part of
      // the public/external API and/or used by the runtime-generated code.
      fromWireType(value) {
        var length = HEAPU32[value >>> 2 >>> 0];
        var payload = value + 4;
        var str;
        if (stdStringIsUTF8) {
          str = UTF8ToString(payload, length, true);
        } else {
          str = "";
          for (var i = 0; i < length; ++i) {
            str += String.fromCharCode(HEAPU8[payload + i >>> 0]);
          }
        }
        _free(value);
        return str;
      },
      toWireType(destructors, value) {
        if (value instanceof ArrayBuffer) {
          value = new Uint8Array(value);
        }
        var length;
        var valueIsOfTypeString = typeof value == "string";
        if (!(valueIsOfTypeString || ArrayBuffer.isView(value) && value.BYTES_PER_ELEMENT == 1)) {
          throwBindingError("Cannot pass non-string to std::string");
        }
        if (stdStringIsUTF8 && valueIsOfTypeString) {
          length = lengthBytesUTF8(value);
        } else {
          length = value.length;
        }
        var base = _malloc(4 + length + 1);
        var ptr = base + 4;
        HEAPU32[base >>> 2 >>> 0] = length;
        if (valueIsOfTypeString) {
          if (stdStringIsUTF8) {
            stringToUTF8(value, ptr, length + 1);
          } else {
            for (var i = 0; i < length; ++i) {
              var charCode = value.charCodeAt(i);
              if (charCode > 255) {
                _free(base);
                throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
              }
              HEAPU8[ptr + i >>> 0] = charCode;
            }
          }
        } else {
          HEAPU8.set(value, ptr >>> 0);
        }
        if (destructors !== null) {
          destructors.push(_free, base);
        }
        return base;
      },
      readValueFromPointer: readPointer,
      destructorFunction(ptr) {
        _free(ptr);
      }
    });
  }
  var UTF16Decoder = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0;
  var UTF16ToString = (ptr, maxBytesToRead, ignoreNul) => {
    var idx = ptr >>> 1;
    var endIdx = findStringEnd(HEAPU16, idx, maxBytesToRead / 2, ignoreNul);
    if (endIdx - idx > 16 && UTF16Decoder) return UTF16Decoder.decode(HEAPU16.subarray(idx >>> 0, endIdx >>> 0));
    var str = "";
    for (var i = idx; i < endIdx; ++i) {
      var codeUnit = HEAPU16[i >>> 0];
      str += String.fromCharCode(codeUnit);
    }
    return str;
  };
  var stringToUTF16 = (str, outPtr, maxBytesToWrite) => {
    maxBytesToWrite ??= 2147483647;
    if (maxBytesToWrite < 2) return 0;
    maxBytesToWrite -= 2;
    var startPtr = outPtr;
    var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
    for (var i = 0; i < numCharsToWrite; ++i) {
      var codeUnit = str.charCodeAt(i);
      HEAP16[outPtr >>> 1 >>> 0] = codeUnit;
      outPtr += 2;
    }
    HEAP16[outPtr >>> 1 >>> 0] = 0;
    return outPtr - startPtr;
  };
  var lengthBytesUTF16 = (str) => str.length * 2;
  var UTF32ToString = (ptr, maxBytesToRead, ignoreNul) => {
    var str = "";
    var startIdx = ptr >>> 2;
    for (var i = 0; !(i >= maxBytesToRead / 4); i++) {
      var utf32 = HEAPU32[startIdx + i >>> 0];
      if (!utf32 && !ignoreNul) break;
      str += String.fromCodePoint(utf32);
    }
    return str;
  };
  var stringToUTF32 = (str, outPtr, maxBytesToWrite) => {
    outPtr >>>= 0;
    maxBytesToWrite ??= 2147483647;
    if (maxBytesToWrite < 4) return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i = 0; i < str.length; ++i) {
      var codePoint = str.codePointAt(i);
      if (codePoint > 65535) {
        i++;
      }
      HEAP32[outPtr >>> 2 >>> 0] = codePoint;
      outPtr += 4;
      if (outPtr + 4 > endPtr) break;
    }
    HEAP32[outPtr >>> 2 >>> 0] = 0;
    return outPtr - startPtr;
  };
  var lengthBytesUTF32 = (str) => {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var codePoint = str.codePointAt(i);
      if (codePoint > 65535) {
        i++;
      }
      len += 4;
    }
    return len;
  };
  function __embind_register_std_wstring(rawType, charSize, name) {
    rawType >>>= 0;
    charSize >>>= 0;
    name >>>= 0;
    name = AsciiToString(name);
    var decodeString, encodeString, lengthBytesUTF;
    if (charSize === 2) {
      decodeString = UTF16ToString;
      encodeString = stringToUTF16;
      lengthBytesUTF = lengthBytesUTF16;
    } else {
      decodeString = UTF32ToString;
      encodeString = stringToUTF32;
      lengthBytesUTF = lengthBytesUTF32;
    }
    registerType(rawType, { name, fromWireType: (value) => {
      var length = HEAPU32[value >>> 2 >>> 0];
      var str = decodeString(value + 4, length * charSize, true);
      _free(value);
      return str;
    }, toWireType: (destructors, value) => {
      if (!(typeof value == "string")) {
        throwBindingError(`Cannot pass non-string to C++ string type ${name}`);
      }
      var length = lengthBytesUTF(value);
      var ptr = _malloc(4 + length + charSize);
      HEAPU32[ptr >>> 2 >>> 0] = length / charSize;
      encodeString(value, ptr + 4, length + charSize);
      if (destructors !== null) {
        destructors.push(_free, ptr);
      }
      return ptr;
    }, readValueFromPointer: readPointer, destructorFunction(ptr) {
      _free(ptr);
    } });
  }
  var __embind_register_void = function(rawType, name) {
    rawType >>>= 0;
    name >>>= 0;
    name = AsciiToString(name);
    registerType(rawType, {
      isVoid: true,
      // void return values can be optimized out sometimes
      name,
      fromWireType: () => void 0,
      // TODO: assert if anything else is given?
      toWireType: (destructors, o) => void 0
    });
  };
  var runtimeKeepaliveCounter = 0;
  var __emscripten_runtime_keepalive_clear = () => {
    noExitRuntime = false;
    runtimeKeepaliveCounter = 0;
  };
  function __emval_array_to_memory_view(dst, src) {
    dst >>>= 0;
    src >>>= 0;
    dst = Emval.toValue(dst);
    src = Emval.toValue(src);
    dst.set(src);
  }
  var emval_methodCallers = [];
  var emval_addMethodCaller = (caller) => {
    var id = emval_methodCallers.length;
    emval_methodCallers.push(caller);
    return id;
  };
  var emval_lookupTypes = (argCount, argTypes) => {
    var a = new Array(argCount);
    for (var i = 0; i < argCount; ++i) {
      a[i] = requireRegisteredType(HEAPU32[argTypes + i * 4 >>> 2 >>> 0], `parameter ${i}`);
    }
    return a;
  };
  var emval_returnValue = (toReturnWire, destructorsRef, handle) => {
    var destructors = [];
    var result = toReturnWire(destructors, handle);
    if (destructors.length) {
      HEAPU32[destructorsRef >>> 2 >>> 0] = Emval.toHandle(destructors);
    }
    return result;
  };
  var emval_symbols = {};
  var getStringOrSymbol = (address) => {
    var symbol = emval_symbols[address];
    if (symbol === void 0) {
      return AsciiToString(address);
    }
    return symbol;
  };
  var __emval_create_invoker = function(argCount, argTypesPtr, kind) {
    argTypesPtr >>>= 0;
    var GenericWireTypeSize = 8;
    var [retType, ...argTypes] = emval_lookupTypes(argCount, argTypesPtr);
    var toReturnWire = retType.toWireType.bind(retType);
    var argFromPtr = argTypes.map((type) => type.readValueFromPointer.bind(type));
    argCount--;
    var argN = new Array(argCount);
    var invokerFunction = (handle, methodName, destructorsRef, args) => {
      var offset = 0;
      for (var i = 0; i < argCount; ++i) {
        argN[i] = argFromPtr[i](args + offset);
        offset += GenericWireTypeSize;
      }
      var rv;
      switch (kind) {
        case 0:
          rv = Emval.toValue(handle).apply(null, argN);
          break;
        case 2:
          rv = Reflect.construct(Emval.toValue(handle), argN);
          break;
        case 3:
          rv = argN[0];
          break;
        case 1:
          rv = Emval.toValue(handle)[getStringOrSymbol(methodName)](...argN);
          break;
      }
      return emval_returnValue(toReturnWire, destructorsRef, rv);
    };
    var functionName = `methodCaller<(${argTypes.map((t) => t.name)}) => ${retType.name}>`;
    return emval_addMethodCaller(createNamedFunction(functionName, invokerFunction));
  };
  function __emval_get_global(name) {
    name >>>= 0;
    if (!name) {
      return Emval.toHandle(globalThis);
    }
    name = getStringOrSymbol(name);
    return Emval.toHandle(globalThis[name]);
  }
  function __emval_get_property(handle, key) {
    handle >>>= 0;
    key >>>= 0;
    handle = Emval.toValue(handle);
    key = Emval.toValue(key);
    return Emval.toHandle(handle[key]);
  }
  function __emval_incref(handle) {
    handle >>>= 0;
    if (handle > 9) {
      emval_handles[handle + 1] += 1;
    }
  }
  function __emval_invoke(caller, handle, methodName, destructorsRef, args) {
    caller >>>= 0;
    handle >>>= 0;
    methodName >>>= 0;
    destructorsRef >>>= 0;
    args >>>= 0;
    return emval_methodCallers[caller](handle, methodName, destructorsRef, args);
  }
  function __emval_new_array() {
    return Emval.toHandle([]);
  }
  function __emval_new_cstring(v) {
    v >>>= 0;
    return Emval.toHandle(getStringOrSymbol(v));
  }
  function __emval_run_destructors(handle) {
    handle >>>= 0;
    var destructors = Emval.toValue(handle);
    runDestructors(destructors);
    __emval_decref(handle);
  }
  var timers = {};
  var handleException = (e) => {
    if (e instanceof ExitStatus || e == "unwind") {
      return EXITSTATUS;
    }
    quit_(1, e);
  };
  var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;
  var _proc_exit = (code) => {
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
      Module2["onExit"]?.(code);
      ABORT = true;
    }
    quit_(code, new ExitStatus(code));
  };
  var exitJS = (status, implicit) => {
    EXITSTATUS = status;
    _proc_exit(status);
  };
  var _exit = exitJS;
  var maybeExit = () => {
    if (!keepRuntimeAlive()) {
      try {
        _exit(EXITSTATUS);
      } catch (e) {
        handleException(e);
      }
    }
  };
  var callUserCallback = (func) => {
    if (ABORT) {
      return;
    }
    try {
      func();
      maybeExit();
    } catch (e) {
      handleException(e);
    }
  };
  var _emscripten_get_now = () => performance.now();
  var __setitimer_js = (which, timeout_ms) => {
    if (timers[which]) {
      clearTimeout(timers[which].id);
      delete timers[which];
    }
    if (!timeout_ms) return 0;
    var id = setTimeout(() => {
      delete timers[which];
      callUserCallback(() => __emscripten_timeout(which, _emscripten_get_now()));
    }, timeout_ms);
    timers[which] = { id, timeout_ms };
    return 0;
  };
  var __tzset_js = function(timezone, daylight, std_name, dst_name) {
    timezone >>>= 0;
    daylight >>>= 0;
    std_name >>>= 0;
    dst_name >>>= 0;
    var currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    var winter = new Date(currentYear, 0, 1);
    var summer = new Date(currentYear, 6, 1);
    var winterOffset = winter.getTimezoneOffset();
    var summerOffset = summer.getTimezoneOffset();
    var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
    HEAPU32[timezone >>> 2 >>> 0] = stdTimezoneOffset * 60;
    HEAP32[daylight >>> 2 >>> 0] = Number(winterOffset != summerOffset);
    var extractZone = (timezoneOffset) => {
      var sign = timezoneOffset >= 0 ? "-" : "+";
      var absOffset = Math.abs(timezoneOffset);
      var hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
      var minutes = String(absOffset % 60).padStart(2, "0");
      return `UTC${sign}${hours}${minutes}`;
    };
    var winterName = extractZone(winterOffset);
    var summerName = extractZone(summerOffset);
    if (summerOffset < winterOffset) {
      stringToUTF8(winterName, std_name, 17);
      stringToUTF8(summerName, dst_name, 17);
    } else {
      stringToUTF8(winterName, dst_name, 17);
      stringToUTF8(summerName, std_name, 17);
    }
  };
  var getHeapMax = () => (
    // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
    // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
    // for any code that deals with heap sizes, which would require special
    // casing all heap size related code to treat 0 specially.
    4294901760
  );
  var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;
  var growMemory = (size) => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = (size - oldHeapSize + 65535) / 65536 | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {
    }
  };
  function _emscripten_resize_heap(requestedSize) {
    requestedSize >>>= 0;
    var oldSize = HEAPU8.length;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
      return false;
    }
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
      var replacement = growMemory(newSize);
      if (replacement) {
        return true;
      }
    }
    return false;
  }
  var ENV = {};
  var getExecutableName = () => thisProgram || "./this.program";
  var getEnvStrings = () => {
    if (!getEnvStrings.strings) {
      var lang = (typeof navigator == "object" && navigator.language || "C").replace("-", "_") + ".UTF-8";
      var env = { "USER": "web_user", "LOGNAME": "web_user", "PATH": "/", "PWD": "/", "HOME": "/home/web_user", "LANG": lang, "_": getExecutableName() };
      for (var x in ENV) {
        if (ENV[x] === void 0) delete env[x];
        else env[x] = ENV[x];
      }
      var strings = [];
      for (var x in env) {
        strings.push(`${x}=${env[x]}`);
      }
      getEnvStrings.strings = strings;
    }
    return getEnvStrings.strings;
  };
  function _environ_get(__environ, environ_buf) {
    __environ >>>= 0;
    environ_buf >>>= 0;
    var bufSize = 0;
    var envp = 0;
    for (var string of getEnvStrings()) {
      var ptr = environ_buf + bufSize;
      HEAPU32[__environ + envp >>> 2 >>> 0] = ptr;
      bufSize += stringToUTF8(string, ptr, Infinity) + 1;
      envp += 4;
    }
    return 0;
  }
  function _environ_sizes_get(penviron_count, penviron_buf_size) {
    penviron_count >>>= 0;
    penviron_buf_size >>>= 0;
    var strings = getEnvStrings();
    HEAPU32[penviron_count >>> 2 >>> 0] = strings.length;
    var bufSize = 0;
    for (var string of strings) {
      bufSize += lengthBytesUTF8(string) + 1;
    }
    HEAPU32[penviron_buf_size >>> 2 >>> 0] = bufSize;
    return 0;
  }
  var _fd_close = (fd) => 52;
  function _fd_seek(fd, offset, whence, newOffset) {
    offset = bigintToI53Checked(offset);
    newOffset >>>= 0;
    return 70;
  }
  var printCharBuffers = [null, [], []];
  var printChar = (stream, curr) => {
    var buffer = printCharBuffers[stream];
    if (curr === 0 || curr === 10) {
      (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
      buffer.length = 0;
    } else {
      buffer.push(curr);
    }
  };
  function _fd_write(fd, iov, iovcnt, pnum) {
    iov >>>= 0;
    iovcnt >>>= 0;
    pnum >>>= 0;
    var num = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAPU32[iov >>> 2 >>> 0];
      var len = HEAPU32[iov + 4 >>> 2 >>> 0];
      iov += 8;
      for (var j = 0; j < len; j++) {
        printChar(fd, HEAPU8[ptr + j >>> 0]);
      }
      num += len;
    }
    HEAPU32[pnum >>> 2 >>> 0] = num;
    return 0;
  }
  var initRandomFill = () => (view) => crypto.getRandomValues(view);
  var randomFill = (view) => {
    (randomFill = initRandomFill())(view);
  };
  function _random_get(buffer, size) {
    buffer >>>= 0;
    size >>>= 0;
    randomFill(HEAPU8.subarray(buffer >>> 0, buffer + size >>> 0));
    return 0;
  }
  var incrementExceptionRefcount = (ex) => {
    var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
    ___cxa_increment_exception_refcount(ptr);
  };
  var decrementExceptionRefcount = (ex) => {
    var ptr = getCppExceptionThrownObjectFromWebAssemblyException(ex);
    ___cxa_decrement_exception_refcount(ptr);
  };
  init_ClassHandle();
  init_RegisteredPointer();
  {
    if (Module2["noExitRuntime"]) noExitRuntime = Module2["noExitRuntime"];
    if (Module2["print"]) out = Module2["print"];
    if (Module2["printErr"]) err = Module2["printErr"];
    if (Module2["wasmBinary"]) wasmBinary = Module2["wasmBinary"];
    if (Module2["arguments"]) arguments_ = Module2["arguments"];
    if (Module2["thisProgram"]) thisProgram = Module2["thisProgram"];
    if (Module2["preInit"]) {
      if (typeof Module2["preInit"] == "function") Module2["preInit"] = [Module2["preInit"]];
      while (Module2["preInit"].length > 0) {
        Module2["preInit"].shift()();
      }
    }
  }
  Module2["getExceptionMessage"] = getExceptionMessage;
  Module2["incrementExceptionRefcount"] = incrementExceptionRefcount;
  Module2["decrementExceptionRefcount"] = decrementExceptionRefcount;
  var _malloc, _free, ___getTypeName, __emscripten_timeout, ___trap, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, ___cxa_decrement_exception_refcount, ___cxa_increment_exception_refcount, ___thrown_object_from_unwind_exception, ___get_exception_message, memory, __indirect_function_table, ___cpp_exception, wasmMemory, wasmTable;
  function assignWasmExports(wasmExports2) {
    _malloc = wasmExports2["T"];
    _free = wasmExports2["U"];
    ___getTypeName = wasmExports2["V"];
    __emscripten_timeout = wasmExports2["X"];
    ___trap = wasmExports2["Y"];
    __emscripten_stack_restore = wasmExports2["Z"];
    __emscripten_stack_alloc = wasmExports2["_"];
    _emscripten_stack_get_current = wasmExports2["$"];
    ___cxa_decrement_exception_refcount = wasmExports2["aa"];
    ___cxa_increment_exception_refcount = wasmExports2["ba"];
    ___thrown_object_from_unwind_exception = wasmExports2["da"];
    ___get_exception_message = wasmExports2["ea"];
    memory = wasmMemory = wasmExports2["R"];
    __indirect_function_table = wasmTable = wasmExports2["W"];
    ___cpp_exception = wasmExports2["ca"];
  }
  var wasmImports = {
    /** @export */
    r: ___assert_fail,
    /** @export */
    v: ___throw_exception_with_stack_trace,
    /** @export */
    C: __abort_js,
    /** @export */
    x: __embind_register_bigint,
    /** @export */
    N: __embind_register_bool,
    /** @export */
    h: __embind_register_class,
    /** @export */
    k: __embind_register_class_class_function,
    /** @export */
    y: __embind_register_class_class_property,
    /** @export */
    i: __embind_register_class_constructor,
    /** @export */
    a: __embind_register_class_function,
    /** @export */
    p: __embind_register_class_property,
    /** @export */
    L: __embind_register_emval,
    /** @export */
    t: __embind_register_enum,
    /** @export */
    m: __embind_register_enum_value,
    /** @export */
    w: __embind_register_float,
    /** @export */
    u: __embind_register_function,
    /** @export */
    n: __embind_register_integer,
    /** @export */
    j: __embind_register_memory_view,
    /** @export */
    Q: __embind_register_optional,
    /** @export */
    M: __embind_register_std_string,
    /** @export */
    s: __embind_register_std_wstring,
    /** @export */
    O: __embind_register_void,
    /** @export */
    A: __emscripten_runtime_keepalive_clear,
    /** @export */
    q: __emval_array_to_memory_view,
    /** @export */
    e: __emval_create_invoker,
    /** @export */
    b: __emval_decref,
    /** @export */
    l: __emval_get_global,
    /** @export */
    f: __emval_get_property,
    /** @export */
    o: __emval_incref,
    /** @export */
    d: __emval_invoke,
    /** @export */
    P: __emval_new_array,
    /** @export */
    g: __emval_new_cstring,
    /** @export */
    c: __emval_run_destructors,
    /** @export */
    B: __setitimer_js,
    /** @export */
    E: __tzset_js,
    /** @export */
    H: _emscripten_resize_heap,
    /** @export */
    F: _environ_get,
    /** @export */
    G: _environ_sizes_get,
    /** @export */
    K: _fd_close,
    /** @export */
    J: _fd_seek,
    /** @export */
    I: _fd_write,
    /** @export */
    z: _proc_exit,
    /** @export */
    D: _random_get
  };
  function applySignatureConversions(wasmExports2) {
    wasmExports2 = Object.assign({}, wasmExports2);
    var makeWrapper_pp = (f) => (a0) => f(a0) >>> 0;
    var makeWrapper_p = (f) => () => f() >>> 0;
    wasmExports2["T"] = makeWrapper_pp(wasmExports2["T"]);
    wasmExports2["V"] = makeWrapper_pp(wasmExports2["V"]);
    wasmExports2["_"] = makeWrapper_pp(wasmExports2["_"]);
    wasmExports2["$"] = makeWrapper_p(wasmExports2["$"]);
    return wasmExports2;
  }
  function run() {
    preRun();
    function doRun() {
      Module2["calledRun"] = true;
      if (ABORT) return;
      initRuntime();
      readyPromiseResolve?.(Module2);
      Module2["onRuntimeInitialized"]?.();
      postRun();
    }
    if (Module2["setStatus"]) {
      Module2["setStatus"]("Running...");
      setTimeout(() => {
        setTimeout(() => Module2["setStatus"](""), 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  var wasmExports;
  wasmExports = await createWasm();
  run();
  if (runtimeInitialized) {
    moduleRtn = Module2;
  } else {
    moduleRtn = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
  }
  ;
  return moduleRtn;
}
var seal_throws_default = Module;

// node_modules/.pnpm/node-seal@7.0.0/node_modules/node-seal/dist/index_throws.js
async function initialize(options = {}) {
  return await seal_throws_default({
    locateFile: (path) => new URL(path, import.meta.url).href,
    ...options
  });
}
var index_throws_default = initialize;
export {
  index_throws_default as default,
  initialize
};
//# sourceMappingURL=node-seal.js.map
