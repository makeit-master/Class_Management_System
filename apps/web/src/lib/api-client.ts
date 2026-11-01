
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiOptions = RequestInit & {
  token?: string | null;
};

// Only authenticated requests can trigger an automatic logout.
type UnauthorizedHandler = (rejectedToken: string) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | null
): void {
  unauthorizedHandler = handler;
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (rest.body && !(rest.body instanceof FormData)) {
    if (!requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }
  }

  let response: Response;

  try {
    response = await fetch(`/api${endpoint}`, {
      ...rest,
      headers: requestHeaders,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Cannot connect to the server."
    );
  }

  let result: ApiEnvelope<T>;

  try {
    result = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (response.status === 401 && token) {
      unauthorizedHandler?.(token);
    }

    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "Server returned an invalid response."
    );
  }

  if (!response.ok || !result.success) {
    if (response.status === 401 && token) {
      unauthorizedHandler?.(token);
    }

    throw new ApiError(
      response.status,
      result.error?.code ?? "REQUEST_ERROR",
      result.error?.message ?? "Request failed."
    );
  }

  if (result.data === undefined) {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "Server response is missing data."
    );
  }

  return result.data;
}
