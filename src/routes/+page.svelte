<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { reset } from '$lib/wizard/state.svelte';
  import { loadKitIntoState } from '$lib/state/kit.svelte';
  import { listKits, loadKit, deleteKit } from '$lib/storage/db';

  let kits = $state<Array<{ id: string; name: string; updatedAt: number; surfaceNames: string[] }>>(
    []
  );
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let toast = $state<string | null>(null);

  // Check for redirect reason
  $effect(() => {
    const reason = page.url.searchParams.get('reason');
    if (reason === 'no-kit') {
      toast = 'No kit loaded.';
      setTimeout(() => {
        toast = null;
      }, 3000);
    }
  });

  // Load kit list on mount
  $effect(() => {
    refreshList();
  });

  async function refreshList() {
    try {
      loading = true;
      loadError = null;
      kits = await listKits();
    } catch {
      loadError = 'Failed to load saved kits.';
    } finally {
      loading = false;
    }
  }

  function handleNewKit() {
    reset();
    goto(resolve('/train/setup'));
  }

  async function handleLoad(id: string) {
    try {
      loadError = null;
      const kit = await loadKit(id);
      if (!kit) {
        loadError = 'Kit not found. It may have been deleted.';
        await refreshList();
        return;
      }
      loadKitIntoState(kit);
      goto(resolve('/play'));
    } catch {
      loadError = 'Failed to load kit. Try again or create a new one.';
    }
  }

  async function handleDelete(id: string) {
    try {
      deletingId = id;
      await deleteKit(id);
      confirmDeleteId = null;
      await refreshList();
    } catch {
      loadError = 'Failed to delete kit.';
    } finally {
      deletingId = null;
    }
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-950 p-8">
  <h1 class="mb-2 text-4xl font-bold text-white">✏️ No. 2 Drummer</h1>
  <p class="mb-12 text-gray-500">The world is your drum kit</p>

  <iframe
    title="George"
    src="https://giphy.com/embed/ly69OqtnnQg2k"
    width="480"
    height="353"
    style=""
    frameBorder="0"
    class="giphy-embed"
    allowFullScreen
  ></iframe>
  <p><a href="https://giphy.com/gifs/office-ly69OqtnnQg2k">via GIPHY</a></p>


  {#if toast}
    <div class="mb-4 rounded-lg bg-yellow-900/20 px-4 py-2 text-sm text-yellow-400">
      {toast}
    </div>
  {/if}

  {#if loadError}
    <div class="mb-4 max-w-md rounded-lg bg-red-900/30 p-4 text-sm text-red-300">
      {loadError}
    </div>
  {/if}

  <div class="flex w-full max-w-md flex-col gap-4">
    <button
      class="rounded-lg bg-green-500 px-8 py-3 text-center font-semibold text-black
        transition-colors hover:bg-green-400"
      onclick={handleNewKit}
      type="button"
    >
      New Kit
    </button>

    {#if loading}
      <div class="py-4 text-center text-sm text-gray-500">Loading saved kits...</div>
    {:else if kits.length === 0}
      <div class="py-4 text-center text-sm text-gray-600">
        No saved kits yet. Create one to get started!
      </div>
    {:else}
      <div class="mt-2 space-y-2">
        <div class="text-xs font-semibold tracking-wider text-gray-500 uppercase">Saved Kits</div>
        {#each kits as kit (kit.id)}
          <div
            class="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 p-3"
          >
            <button class="flex-1 text-left" onclick={() => handleLoad(kit.id)} type="button">
              <div class="text-sm font-medium text-white">{kit.name}</div>
              <div class="text-xs text-gray-500">
                {kit.surfaceNames.length} surfaces · {formatDate(kit.updatedAt)}
              </div>
            </button>

            {#if confirmDeleteId === kit.id}
              <div class="flex gap-1">
                <button
                  class="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30"
                  onclick={() => handleDelete(kit.id)}
                  disabled={deletingId === kit.id}
                  type="button"
                >
                  {deletingId === kit.id ? '...' : 'Confirm'}
                </button>
                <button
                  class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-800"
                  onclick={() => {
                    confirmDeleteId = null;
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            {:else}
              <button
                class="rounded px-2 py-1 text-xs text-gray-600 hover:text-red-400"
                onclick={() => {
                  confirmDeleteId = kit.id;
                }}
                type="button"
              >
                Delete
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
