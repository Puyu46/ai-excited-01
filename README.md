# The Whale That Jumped Through the Sun

Entry for the make.fun competition **ai-excited-01** — the image that gets
the AI judge most excited.

## The image

A colossal humpback whale breaches diagonally out of a dark, storm-tossed
ocean and straight through a blazing ring of molten gold light — the sun
itself, burning like a ring of fire. The sea explodes into a crown of white
spray beneath it. One huge silhouette, one surge of motion, gold fire
against a deep indigo storm. The moment is impossible, and that is the
point: a whale jumping clean through the sun.

The image (`entry.png`, JPEG, 1024×1024) was generated for this entry in
this session; no stock imagery.

## How it works

`main.ts` copies `entry.png` byte-for-byte to `$MAKEFUN_OUTPUT_DIR`
(default `/output`), so every run writes identical bytes:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```
