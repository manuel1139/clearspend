# Azure App Service Deployment

This repository is set up to run as a single Azure App Service that serves:

- the frontend build from `dist/`
- the Express API from `server/dist/server/`

## Expected Azure Build/Run Flow

Azure should be able to deploy the current commit with the normal Node workflow:

1. install dependencies
2. run `npm run build`
3. run `npm start`

Because this repository contains a `yarn.lock`, Azure/Oryx may choose Yarn automatically during deployment. That is fine as long as remote build is enabled and the build step runs.

## Required App Settings

Set these in Azure App Service under **Settings > Configuration > Application settings** (do **NOT** use "Connection strings" for the API key):

- `AZURE_SQL_CONNECTION_STRING`
- `NODE_ENV=production`
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- `GEMINI_API_KEY`

> **Important:** Azure injects "Application settings" as standard environment variables (e.g., `process.env.GEMINI_API_KEY`). If you place the API key in the "Connection strings" section, Azure will prefix it based on the type (e.g., `CUSTOMCONNSTR_GEMINI_API_KEY`), which will cause the application to fail to find it by its raw name.

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

## Azure Checks If The Site Loads `/src/main.tsx`

If production requests `/src/main.tsx`, Azure is serving the source `index.html` instead of the built `dist/index.html`.

Check these items:

1. `SCM_DO_BUILD_DURING_DEPLOYMENT` is set to `true`
2. deployment logs show the build step ran successfully
3. startup command is `npm start`
4. the deployed artifact contains:
   - `dist/index.html`
   - `dist/assets/...`
   - `server/dist/server/index.js`
