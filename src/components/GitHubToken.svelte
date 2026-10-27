<script lang="ts">
  // Asks for the GitHub token that lets Save commit library.json from the
  // site (see src/lib/github.ts). The token stays in this browser.
  import type { GitHubSource } from "../lib/github.ts";

  let {
    github,
    message,
    ondone,
    oncancel,
  }: {
    github: GitHubSource;
    /** Why the token is asked for again, e.g. GitHub rejected the saved one. */
    message: string | null;
    ondone: () => void;
    oncancel: () => void;
  } = $props();

  let token = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  // A fine-grained token form, prefilled where GitHub allows it. The
  // repository itself still has to be picked by hand.
  const createUrl = $derived(
    "https://github.com/settings/personal-access-tokens/new?" +
      new URLSearchParams({
        name: "FliTunes",
        description: `Save library.json to ${github.repoName} from FliTunes`,
        target_name: github.file.owner,
        contents: "write",
      }),
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = null;
    try {
      await github.setToken(token);
      ondone();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<form class="token" onsubmit={submit}>
  <h2>Save to GitHub</h2>
  {#if message}<p class="hint warning">{message}</p>{/if}
  <p>
    Save commits library.json to <strong>{github.repoName}</strong>. Paste a
    <a href={createUrl} target="_blank" rel="noreferrer">fine-grained personal access token</a> with access to
    that repository only, and the permission <em>Contents: Read and write</em>.
  </p>
  <p class="sub">The token is kept in this browser only. Right-click Save to forget it.</p>

  <label>
    Token
    <!-- svelte-ignore a11y_autofocus -->
    <input type="password" bind:value={token} required autocomplete="off" spellcheck="false" autofocus />
  </label>

  {#if error}<p class="hint error">{error}</p>{/if}

  <div class="actions">
    <button type="button" class="aqua" onclick={oncancel}>Cancel</button>
    <button class="aqua default" disabled={busy || !token.trim()}>{busy ? "Checking…" : "Save"}</button>
  </div>
</form>

<style>
  .token {
    padding: 14px 18px;
  }
  h2 {
    margin: 0 0 10px;
    font-size: 13px;
  }
  p {
    margin: 0 0 8px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 8px;
  }
  input {
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  .sub {
    color: #666;
    font-size: 0.85em;
  }
  .hint {
    margin: 4px 0;
    font-size: 0.9em;
  }
  .error {
    color: #c00;
  }
  .warning {
    color: #a60;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 12px;
  }
</style>
