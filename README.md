# Thread Call Path Visualizer

A small web app for sketching multi-threaded call flows side by side in Monaco editors and automatically aligning matching synchronization points across threads. Each thread is edited as normal code-like text, while the app inserts visual spacing around matching sync lines so related steps line up even when threads have different lengths or wrapped lines. It also supports local persistence, named saved snapshots, and JSON-based state copy/edit/apply for quick iteration.


## Prerequisite

- Node `24.15.0`.


## Run locally

```powershell
npm install
npm run dev
```

Open the local URL shown by Vite in your browser.


## Build

```powershell
npm run build
npm run preview
```
