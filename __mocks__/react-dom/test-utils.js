// React 19 test-utils compatibility mock
export const act = (callback) => {
  return callback();
};

export default {
  act,
};
