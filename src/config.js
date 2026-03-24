const required = (key) => {
  const value = import.meta.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const config = {
  tenantId: required("VITE_TENANT_ID"),
  clientId: required("VITE_CLIENT_ID"),
  apiBaseUrl: required("VITE_API_BASE_URL"),
};
