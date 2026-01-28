/**
 * Polyfill for node:tls module
 */

export function createServer() {
  return {
    listen: () => {},
    on: () => {},
    close: () => {},
  };
}

export function connect() {
  return {
    on: () => {},
    write: () => {},
    end: () => {},
  };
}

export function createConnection() {
  return connect();
}

export default {
  createServer,
  connect,
  createConnection,
};
