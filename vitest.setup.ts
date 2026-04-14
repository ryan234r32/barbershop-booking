// Test environment defaults. Real deploys must set these via env vars.
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.LINE_CHANNEL_ID ??= "test-channel-id";
process.env.LINE_CHANNEL_SECRET ??= "test-channel-secret";
process.env.LINE_CHANNEL_ACCESS_TOKEN ??= "test-access-token";
process.env.DEFAULT_TENANT_ID ??= "test-tenant";
