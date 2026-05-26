# RXF — eXtreme Flash Format

**Lightweight binary format for 2D interactive content. Modern alternative to legacy Flash.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## What is RXF?

RXF is a modern, lightweight binary format for creating 2D animations, interactive content, and games. It includes:

- **RXF format** — compact binary structure with streaming support
- **XFC language** — simple scripting language for animations
- **JavaScript Player** — embed anywhere with one line of code

No plugins. No legacy code. Just pure HTML5/Canvas.

---

## Quick Start

### Embed player on your website

```html
<script src="https://cdn.jsdelivr.net/gh/yourname/rxf/player.js"></script>
<div data-rxf="animation.rxf" width="800" height="600"></div>
