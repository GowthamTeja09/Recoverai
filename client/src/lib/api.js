function extractMessage(payload, status) {
  const message =
    payload?.error ||
    payload?.message ||
    payload?.detail ||
    payload?.details ||
    null;

  if (message) return message;

  switch (status) {
    case 400:
      return 'Invalid request.';
    case 401:
      return 'Authentication required.';
    case 403:
      return 'Access denied.';
    case 404:
      return 'Resource not found.';
    case 409:
      return 'Conflict: the operation could not be completed.';
    default:
      return status >= 500 ? 'Server error. Please try again.' : `Request failed with status ${status}.`;
  }
}

export async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(extractMessage(payload, response.status));
    error.status = response.status;
    error.response = payload;
    throw error;
  }

  return payload;
}

export function getFriendlyApiError(error, fallback = 'Something went wrong.') {
  if (!error) return fallback;
  if (error.message) return error.message;
  return fallback;
}
