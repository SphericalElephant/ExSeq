'use strict';

module.exports = (status, errInput) => {
  const err = errInput instanceof Error ? errInput : new Error(errInput);
  err.success = false;
  err.status = status;
  err.result = !(errInput instanceof Error) ? errInput : null;
  err.isCreatedError = true;
  return err;
};
