#include "status.hpp"

namespace jnn {
namespace {
thread_local std::string g_lastError;
}

jnn_status fail(jnn_status status, std::string message) {
  g_lastError = std::move(message);
  return status;
}

void clearLastError() { g_lastError.clear(); }

const char* lastErrorMessage() { return g_lastError.c_str(); }

}  // namespace jnn
