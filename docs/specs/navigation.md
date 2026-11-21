# Navigation

## Purpose

Move around the library like a web page: the address says where the main
view is, so a place can be reloaded or bookmarked, and the browser's Back
and Forward retrace the steps.

## Behavior

- `navigation.address` The address holds where the main view is: the
  source, the column picks, the search, and the album whose tracks are
  shown. Opening or reloading an address shows that place. The plain
  library (Music, nothing picked, no search) has no suffix. The view,
  the sort, the link filter and the selection aren't part of it.
- `navigation.back-forward` Each change of source, column pick, search or
  shown tracks is a step that the browser's Back and Forward go through.
  Typing a search is one step, however many letters it takes.
- `navigation.unknown` An address that isn't recognised shows Music.

## UI and shortcuts

- The browser's Back and Forward buttons and shortcuts.
