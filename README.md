# Thread Call Path Visualizer

A web app for writing multi-threaded call flows side by side and aligning sync points in time.

https://qtax.github.io/thread-visualizer

**NOTE: Vibe coded without much code review.**

![Screenshot of the thread editors](screenshot.png)


## Features

- Edit each thread side by side as pseudo-code or real code.
- Align matching `[sync ID]`, `[wait ID]`, and `[set ID]` markers across threads.
- Add, reorder, rename and remove threads.
- Save and load thread states.


## Development

### Prerequisite

- Node `24.15.0`.


### Run locally

```powershell
npm install
npm run dev
```


### Build

```powershell
npm run build
npm run preview
```


## Publish to GitHub Pages

This repository is configured to deploy to GitHub Pages from GitHub Actions.

1. Push to the default branch (`master` in this repository).
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions` if it is not already enabled.
4. Run/wait for the `Deploy to GitHub Pages` workflow to finish.
