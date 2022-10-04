<h1 align="center">Notesnook Importer</h1>
<h3 align="center">Import your notes from any app into Notesnook</h3>
<p align="center">
<a href="https://importer.notesnook.com/">Try it out!</a> | <a href="#developer-guide">Developer guide</a> | <a href="#build-instructions">How to build?</a>
</p>

## Build instructions

### Setting up the development environment

Requirements:

1. [Node.js](https://nodejs.org/en/download/)
2. [git](https://git-scm.com/downloads)
3. NPM (not yarn or pnpm)

Before you can do anything, you'll need to [install Node.js](https://nodejs.org/en/download/) on your system.

Once you have completed the setup, the first step is to `clone` the monorepo:

```bash
git clone https://github.com/streetwriters/notesnook-importer.git

# change directory
cd notesnook-importer
```

Once you are inside the `./notesnook-importer` directory, run the preparation step:

```bash
# this might take a while to complete
npm install
```

Now you can finally start the importer:

```bash
npm run start
```

If you'd like to build in production mode:

```bash
npm run build

# serve the app locally
npx serve apps/importer/build
```

### Running the tests

When you are done making the required changes, you need to run the tests. The tests can be started with a single command:

```bash
npm run test:core
```
