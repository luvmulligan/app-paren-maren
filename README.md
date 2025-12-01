# ParenMaren

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Deployment (Docker + GitHub Actions)

This repo includes CI templates to build and publish the server as a Docker image (GHCR) and to deploy the client to GitHub Pages.

What was added
- `server/Dockerfile` — container image for the Node.js server
- `.github/workflows/server-ghcr.yml` — builds/pushes the server image to GitHub Container Registry (GHCR) on push to main
- `.github/workflows/client-pages.yml` — builds the Angular client and publishes the build output in `dist/paren-maren` to GitHub Pages on push to main

Notes & next steps
- GHCR (GitHub Container Registry) can accept pushes from Actions. The workflow uses the `GITHUB_TOKEN` for authentication; if you prefer using a package PAT create one with `write:packages`, add it as a repository secret (e.g. `GHCR_TOKEN`) and update the workflow to use it.
- The server image is pushed to `ghcr.io/<owner>/paren-maren-server:latest` and `:<sha>`.
- The client is published to GitHub Pages using the official GitHub Pages actions pipeline; the workflow builds the project and deploys `dist/paren-maren`.

Deployment targets
- If you want a fully managed server with WebSocket support (recommended for a quick start), consider Render, Fly.io, or Railway and use the built Docker image or deploy directly from the repository.
- For production-level auto-scaling consider: Cloud Run, ECS/Fargate, or a managed Kubernetes cluster; remember to use a message broker / Redis if you scale to multiple instances.

If you want, I can:
- Add a workflow to automatically deploy the built server image to a platform such as Google Cloud Run (requires linking secrets), or
- Add a Dockerfile and GH Actions step to build/publish a client Docker image (for platforms that serve static content via containers).

