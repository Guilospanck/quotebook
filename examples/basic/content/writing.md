---
title: Writing quotes
description: The markdown conventions quotebook understands.
order: 3
---

Each quote on this page follows the rule it describes.

> Each blockquote in a file becomes one quote:
>
> ```md
> > Simplicity is prerequisite for reliability.
> ```
>
> — the basic rule
<!-- tags: syntax -->

> End a quote with a line that starts with a dash,
> and that line becomes the citation.
>
> — this line, for instance
<!-- tags: syntax -->

> Frontmatter at the top of the file names the book:
>
> ```yaml
> ---
> title: Meditations
> author: Marcus Aurelius
> order: 1
> ---
> ```
>
> — the top of every file
<!-- tags: syntax -->

> Line breaks are kept,
> so poems stay poems
> and verses keep their shape.
>
> — on verse
<!-- tags: formatting -->

> Tag a quote with a comment right after it:
> `<!-- tags: example -->`
>
> — this quote is tagged, see the right
<!-- tags: example -->

> Give a quote its own address with `<!-- id: name -->`.
> This one lives at `#custom-ids`.
>
> — a named quote
<!-- id: custom-ids -->

> *Emphasis*, **strong** and [links](https://commonmark.org) work inside quotes.
> Raw HTML never does.
>
> — on markdown
<!-- tags: formatting -->

> Files that start with an underscore are drafts.
> They stay in your repository, but never reach the site.
>
> — on drafts
