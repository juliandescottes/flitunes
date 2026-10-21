<script lang="ts">
  // The Get Info window: one album, or Multiple Item Information.
  import type { Library } from "../lib/library.svelte.ts";
  import type { Album } from "../lib/model.ts";
  import InfoForm from "./InfoForm.svelte";
  import MultiInfoForm from "./MultiInfoForm.svelte";

  let {
    library,
    albums,
    canPrevious,
    canNext,
    onnavigate,
    ondelete,
    onclose,
  }: {
    library: Library;
    albums: Album[];
    canPrevious: boolean;
    canNext: boolean;
    onnavigate: (delta: 1 | -1) => void;
    ondelete: () => void;
    onclose: () => void;
  } = $props();

  let tab = $state<"info" | "artwork">("info");
</script>

<div class="titlebar">
  <button type="button" class="close" aria-label="Close" title="Close" onclick={onclose}></button>
  <span class="title">{albums.length === 1 ? albums[0].title : "Multiple Item Information"}</span>
</div>

{#if albums.length === 1}
  <!-- A fresh form per album, so Previous / Next start from that album's values. -->
  {#key albums[0].id}
    <InfoForm {library} album={albums[0]} bind:tab {canPrevious} {canNext} {onnavigate} {ondelete} {onclose} />
  {/key}
{:else if albums.length > 1}
  <MultiInfoForm {library} {albums} {onclose} />
{/if}

<style>
  .titlebar {
    position: relative;
    text-align: center;
    padding: 3px 60px;
    background: linear-gradient(oklch(93.7% calc(0.016 * var(--tint)) var(--hue)), oklch(82.3% calc(0.032 * var(--tint)) var(--hue)));
    border-bottom: 1px solid oklch(64.0% calc(0.031 * var(--tint)) var(--hue));
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* The red close light of a Mac OS X 10.6 window. */
  .close {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 13px;
    height: 13px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid #a13a33;
    background: radial-gradient(circle at 50% 30%, #ffb1a6 0, #e5463a 60%, #b6261c 100%);
    cursor: default;
  }
  .close:hover::after {
    content: "×";
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 11px;
    line-height: 1;
    color: #5a0d08;
  }
</style>
