export async function apiFetch(url: string, token: string, options: RequestInit = {}): Promise<Response> {
  // If the body is FormData, let the browser set Content-Type (with boundary) automatically.
  const isFormData = options.body instanceof FormData;
  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
