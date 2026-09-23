---
title: Publishing
description: Configuration, GitHub Pages and other hosts.
order: 4
---

> A project site lives under its repository's name,
> so its links need a base path:
>
> ```json
> { "basePath": "/my-repo/" }
> ```
>
> `quotebook init` reads your git remote and fills it in for you.
>
> — on base paths

> Choose one layout for the whole site,
> or override it for a single book:
>
> ```yaml
> layout: slides
> ```
>
> — on layouts

> Restyle everything with a few variables:
>
> ```css
> :root { --accent: #2f6f4f; --measure: 38rem; }
> ```
>
> — customCss, in quotebook.config.json

> Anywhere that serves static files will do.
> Build with `npx quotebook build`
> and publish the `dist` folder.
>
> — on other hosts
