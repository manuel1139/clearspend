# Azure App Service Deployment

This repository is set up to run as a single Azure App Service that serves:

- the frontend build from `dist/`
- the Express API from `server/dist/server/`

## Expected Azure Build/Run Flow

Azure should be able to deploy the current commit with the normal Node workflow:

1. install dependencies
2. run `npm run build`
3. run `npm start`

## Required App Settings

Set these in Azure App Service Configuration:

- `AZURE_SQL_CONNECTION_STRING`
- `NODE_ENV=production`

Set this as well if AI receipt scanning/import is used:

- `GEMINI_API_KEY`

## Port Handling

The server reads `process.env.PORT` and falls back to `3000` locally.
Azure App Service will inject `PORT` automatically.

## Important Scripts

Root scripts:

- `npm run build`
  Builds the Vite frontend and compiles the server TypeScript to JS.
- `npm start`
  Starts the compiled backend with Node.

Server scripts:

- `npm --prefix server run build`
  Compiles backend code into `server/dist/`.
- `npm --prefix server run start`
  Runs `server/dist/server/index.js`.

## Output Locations

- frontend output: `dist/`
- backend output: `server/dist/`

## Notes

- The Express backend is now separated into the `server/` folder.
- Shared backend/frontend types live in `shared/types.ts`.
- Database schema bootstrap still runs from the backend during startup.
- A temporary manual SQL migration also exists at `temp-migrate-database.sql`.

## Recommended Azure Startup Command

Usually this is enough:

```bash
npm start
```

If your deployment setup requires an explicit startup command, use:

```bash
npm start
```
