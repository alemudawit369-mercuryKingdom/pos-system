export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    // Optional: Handle auto-logout or redirect
    // localStorage.removeItem("token");
    // window.location.href = "/login";
  }

  return response;
}
