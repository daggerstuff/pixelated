import {
  __commonJS
} from "./chunk-PLDDJCW6.js";

// browser-external:node:inspector
var require_node_inspector = __commonJS({
  "browser-external:node:inspector"(exports, module) {
    module.exports = Object.create(new Proxy({}, {
      get(_, key) {
        if (key !== "__esModule" && key !== "__proto__" && key !== "constructor" && key !== "splice") {
          console.warn(`Module "node:inspector" has been externalized for browser compatibility. Cannot access "node:inspector.${key}" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.`);
        }
      }
    }));
  }
});
export default require_node_inspector();
//# sourceMappingURL=node_inspector-HTDAQJXE.js.map
