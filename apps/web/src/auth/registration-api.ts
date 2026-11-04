export async function registrationRequest(
  path: string,
  body?: unknown,
  token?: string,
) {
  const response = await fetch(`/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error?.message ?? "Request failed"), {
      fields: result.error?.fields,
    });
  return result.data;
}
