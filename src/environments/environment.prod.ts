// Production environment configuration.
// Replaces environment.ts during `ng build --configuration production`.
export const environment = {
  production: true,
  apiUrl: 'https://cozy-behdaung-node-api.YOUR_SUBDOMAIN.workers.dev', // Replace with your deployed API URL
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',  // Replace with your Google OAuth client ID
};

