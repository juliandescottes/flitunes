<script lang="ts">
  // A list of values shown as removable chips, plus an input with
  // autocomplete to add more. Used for genres (ids, first = primary) and
  // playlists (tag names).
  let {
    values = $bindable(),
    suggestions,
    resolve,
    labelFor = (key: string) => key,
    actionLabel = () => "Add",
    placeholder = "Add",
    primary = false,
  }: {
    values: string[];
    /** Names offered by the autocomplete. */
    suggestions: string[];
    /** Turns a typed name into the value to add (may create it). */
    resolve: (name: string) => string | Promise<string>;
    labelFor?: (key: string) => string;
    actionLabel?: (name: string) => string;
    placeholder?: string;
    /** Highlight the first value and let others be promoted to first. */
    primary?: boolean;
  } = $props();

  const listId = $props.id();
  let text = $state("");
  let error = $state<string | null>(null);

  async function add() {
    const name = text.trim();
    if (!name) return;
    error = null;
    try {
      const key = await resolve(name);
      if (!values.includes(key)) values = [...values, key];
      text = "";
    } catch (e) {
      error = (e as Error).message;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    } else if (event.key === "Backspace" && text === "" && values.length > 0) {
      values = values.slice(0, -1);
    }
  }
</script>

<div class="chips">
  {#each values as key, i (key)}
    <span class="chip" class:primary={primary && i === 0}>
      {#if primary && i > 0}
        <button type="button" class="label" title="Make primary" onclick={() => (values = [key, ...values.filter((v) => v !== key)])}>
          {labelFor(key)}
        </button>
      {:else}
        <span class="label">{labelFor(key)}</span>
      {/if}
      <button type="button" class="remove" aria-label="Remove {labelFor(key)}" onclick={() => (values = values.filter((v) => v !== key))}>×</button>
    </span>
  {/each}
  <input list={listId} {placeholder} size="10" bind:value={text} {onkeydown} />
  <datalist id={listId}>
    {#each suggestions as name (name)}<option value={name}></option>{/each}
  </datalist>
  {#if text.trim()}
    <button type="button" class="aqua" onclick={add}>{actionLabel(text.trim())}</button>
  {/if}
</div>
{#if error}<p class="error">{error}</p>{/if}

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 2px 3px;
    background: #fff;
    border: 1px solid #a5a5a5;
    box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.15);
    min-height: 20px;
  }
  input {
    flex: 1;
    min-width: 80px;
    border: none;
    outline: none;
    font: inherit;
    padding: 1px 2px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border-radius: 9px;
    padding: 0 4px 0 7px;
    background: linear-gradient(#e9eef6, #cdd7e6);
    border: 1px solid #9eaec6;
  }
  .chip.primary {
    background: linear-gradient(#bcd4f4, #8fb3e6);
    border-color: #5d86c0;
    font-weight: bold;
  }
  .chip button {
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: default;
  }
  .remove {
    color: #4a5a72;
    font-size: 12px;
    line-height: 1;
    padding: 0 2px;
  }
  .error {
    margin: 2px 0 0;
    color: #c00;
  }
</style>
