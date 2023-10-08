<script setup lang="ts">
</script>

<template>
  <main>
    <ul role="list" :class="`w-96 mb-5 rounded-lg overflow-hidden divide-y divide-slate-200`">
      <li class="
        flex
        flex-col
        gap-1
        bg-white
        px-4 py-2
      ">
        <p class="text-sm font-medium text-slate-900">Hello</p>
        <p class="text-sm text-slate-500 truncate">World</p>
      </li>
      <li class="flex flex-col gap-1 bg-white px-4 py-2">
        <p class="text-sm font-medium text-slate-900">Hello</p>
        <p class="text-sm text-slate-500 truncate">World</p>
      </li>
    </ul>

    <button :class="`
      block
      bg-violet-500
      hover:bg-violet-600
      focus:outline-none focus:ring
      focus:ring-violet-300
      active:bg-violet-700
      px-5 py-2 ml-auto
      text-md
      leading-5
      rounded-full
      font-semibold
      text-white
    `">
      Save changes
    </button>
  </main>
</template>
