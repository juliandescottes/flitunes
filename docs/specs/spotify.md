# Spotify

## Purpose

Play the library from FliTunes: signing in to Spotify is optional and only
for playback. Signed in, albums play on one of the user's Spotify devices,
the display shows what's playing, and an album's tracks can be listed.
Nothing fetched from Spotify is saved to the library. (Without a Spotify
client ID in the build, the feature is hidden and albums are plain links.)

## Behavior

### Signing in

- `spotify.sign-in` The Spotify button of the toolbar signs in: it goes to
  Spotify's sign-in page, asking only for playback permissions, and comes
  back to FliTunes with the Spotify parameters removed from the address.
  Signed in, the button is on and its tooltip names the account
  ("Connected to Spotify as Name. Click to disconnect."). The session is
  kept in this browser.
- `spotify.sign-in-errors` A sign-in cancelled on Spotify's page says
  "Spotify sign-in was cancelled."; a return that wasn't started from this
  browser says "This Spotify sign-in wasn't started here. Please try
  again."
- `spotify.sign-out` Clicking the button while signed in signs out. When
  Spotify no longer accepts the session, FliTunes signs out and says
  "Spotify signed you out. Please connect again."

### Playing

- `spotify.play` Signed in, the play button of an album (in the list or
  the grid), Play in its menu, or opening an album linked to a Spotify
  playlist plays it on the active device.
- `spotify.no-device` When no device is active, the command goes to the
  device picked in FliTunes, else to the first device Spotify lists. With
  no device at all, FliTunes says "Open Spotify on one of your devices
  first, then try again."
- `spotify.transport` Signed in, the toolbar has Previous, Play or Pause,
  and Next buttons. `Space` plays or pauses, `⌘←` and `⌘→` go to the
  previous or next track, except while typing in a field, in a menu, or
  with the Add sheet or Get Info open.
- `spotify.devices` The Devices button lists the user's Spotify devices,
  the active one checked, those Spotify doesn't let FliTunes control
  disabled ("No devices: open Spotify on one first" when there are none).
  Picking one moves the playback there.
- `spotify.now-playing` While Spotify plays, the display shows the track,
  its artists and album, the time elapsed and left. What's playing is
  checked every few seconds, and right after each command.
- `spotify.show-playing` A disc button in the display shows the tracks of
  the playing album when it's in the library (found by its link, or by
  the track's album). It's dimmed when the album isn't in the library or
  its tracks are already shown.

### Tracks

- `spotify.tracks` Signed in, opening an album linked to a Spotify album
  (double-click, `Enter`, Show Tracks in its menu) shows its tracks in
  place of the list: the cover, title and artists, then the year, the
  number of songs and the total time. Each row has the track number,
  name, time and artists (Spotify's when they aren't just the album's),
  with the album, genre and year. Albums on several discs are split by
  disc. The year comes from Spotify when the album has none.
- `spotify.tracks-play` Double-clicking a track, or `Enter` on the track
  picked with the arrows, plays the album from that track; the play
  button over the cover plays it from the start. The playing track is
  marked "Playing", or "Paused".
- `spotify.tracks-back` `Escape` in the tracks, the browser's Back, a
  source, a column pick or a search go back to the list. (`Escape` does
  nothing while there are no tracks listed: loading, failed, or none.)
  _(to confirm)_
- `spotify.tracks-errors` When the tracks can't be fetched, the view says
  "Couldn't load the tracks:" and why; an album without tracks says
  "Spotify lists no tracks for this album."
- `spotify.album-menu` Signed in, the album menu also has Play and Show
  Tracks, disabled for several albums, an album without a link, and (Show
  Tracks) an album linked to a playlist.

## UI and shortcuts

- The Spotify button is at the right of the toolbar, before the link
  filter; the playback buttons and the Devices button at its left.
- `Space` play or pause, `⌘←` / `⌘→` previous or next track.
