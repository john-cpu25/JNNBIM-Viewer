#pragma once
#include <string>
#include "jnn/geometry.h"

namespace jnn {

/// Records a failure for jnn_last_error_message() and returns the status.
jnn_status fail(jnn_status status, std::string message);
/// Clears the thread's last error (called on success paths of the C API).
void clearLastError();
const char* lastErrorMessage();

}  // namespace jnn
