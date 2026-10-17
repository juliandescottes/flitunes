<script lang="ts">
  // iTunes rating: five stars, empty slots shown as dots. Clicking the
  // current rating clears it.
  let { value, onchange }: { value: number | null; onchange: (rating: number | null) => void } = $props();
</script>

<span class="stars" role="radiogroup" aria-label="Rating">
  {#each [1, 2, 3, 4, 5] as n (n)}
    <button
      type="button"
      role="radio"
      aria-checked={value === n}
      aria-label="{n} star{n === 1 ? '' : 's'}"
      class:on={value !== null && n <= value}
      onmousedown={(e) => e.stopPropagation()}
      onclick={() => onchange(value === n ? null : n)}
    >
      {value !== null && n <= value ? "★" : "·"}
    </button>
  {/each}
</span>

<style>
  .stars {
    display: inline-flex;
    white-space: nowrap;
  }
  button {
    border: none;
    background: none;
    padding: 0 1px;
    width: 11px;
    font: inherit;
    color: inherit;
    line-height: 1;
    cursor: default;
  }
  /* Dots only show while hovering, unless the parent reveals them (selected rows). */
  button:not(.on) {
    visibility: hidden;
  }
  .stars:hover button,
  .stars:focus-within button,
  :global(.show-dots) button {
    visibility: visible;
  }
</style>
