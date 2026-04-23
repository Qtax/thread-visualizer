# Thread Call Path Visualizer

A web app for writing multi-threaded call flows side by side and aligning sync points in time.

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
