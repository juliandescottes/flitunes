<script lang="ts" module>
  export type MenuItem = { label: string; action: () => void; disabled?: boolean; checked?: boolean } | "separator";
</script>

<script lang="ts">
  // Snow Leopard style context menu, positioned at the mouse.
  import { onMount } from "svelte";

  let { x, y, items, onclose }: { x: number; y: number; items: MenuItem[]; onclose: () => void } = $props();

  let menu: HTMLUListElement;
  // Keep the menu inside the window.
  let left = $state(0);
  let top = $state(0);

  onMount(() => {
    left = Math.min(x, window.innerWidth - menu.offsetWidth - 4);
    top = Math.min(y, window.innerHeight - menu.offsetHeight - 4);
    menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const outside = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) onclose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onclose();
    };
    window.addEventListener("mousedown", outside, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", onclose);
    return () => {
      window.removeEventListener("mousedown", outside, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", onclose);
    };
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...menu.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    const i = buttons.indexOf(document.activeElement as HTMLElement);
    const next = (i + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
</script>

<ul class="menu" role="menu" bind:this={menu} style:left="{left}px" style:top="{top}px" {onkeydown}>
  {#each items as item, i (i)}
    {#if item === "separator"}
      <li class="separator" role="separator"></li>
    {:else}
      <li role="none">
        <button
          role={item.checked === undefined ? "menuitem" : "menuitemradio"}
          aria-checked={item.checked}
          class:checked={item.checked}
          disabled={item.disabled}
          onclick={() => {
            onclose();
            item.action();
          }}
        >
          {item.label}
        </button>
      </li>
    {/if}
  {/each}
</ul>

<style>
  .menu {
    position: fixed;
    z-index: 100;
    list-style: none;
    margin: 0;
    padding: 4px 0;
    min-width: 170px;
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 5px;
    box-shadow: 0 5px 16px rgba(0, 0, 0, 0.35);
    font-size: 13px;
  }
  button {
    display: block;
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    padding: 2px 20px;
    font: inherit;
    color: #000;
    outline: none;
    cursor: default;
  }
  button:hover:not(:disabled),
  button:focus:not(:disabled) {
    background: linear-gradient(#f28db6, #d3487f);
    color: #fff;
  }
  /* A check mark in the left margin, like a Mac menu. */
  button.checked::before {
    content: "✓";
    position: absolute;
    margin-left: -14px;
  }
  button:disabled {
    color: #aaa;
  }
  .separator {
    height: 1px;
    margin: 5px 0;
    background: #f0dfe6;
  }
</style>
