const act = (callback) => {
  const result = callback();
  if (result && typeof result === "object" && "then" in result) {
    return Promise.resolve(result);
  }
  return Promise.resolve();
};

module.exports = { act };
