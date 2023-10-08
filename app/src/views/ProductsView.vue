<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import { RouterView } from 'vue-router'
import type { Product } from "./product";
import { CATALOG_BASE_URL } from './product-api';

const products = ref<Product[]>([]);
const productName = ref("");

onMounted(async () => {
    const { data } = await axios.get(CATALOG_BASE_URL + "/products");
    products.value = data;
});

async function createProduct() {
    const product = { name: productName.value };
    const { data } = await axios.post(CATALOG_BASE_URL + "/products", product);
    products.value.push(data);
    productName.value = "";
}
</script>

<template>
    <div class="products-view">
        <div class="products">
            <ul>
                <li v-for="product of products" :key="product.id">
                    <RouterLink :to="`/` + product.id">
                        <div class="text-3xl font-bold underline">{{product.name}}</div>
                    </RouterLink>
                </li>
            </ul>
            <form class="flex flex-col gap-2" @submit.prevent="createProduct">
                <input class="px-6 py-2 rounded-full text-black" v-model="productName"/>
                <button type="submit" :class="`
                    block
                    bg-violet-500
                    hover:bg-violet-600
                    focus:outline-none focus:ring
                    focus:ring-violet-300
                    active:bg-violet-700
                    px-6 py-2 ml-auto
                    text-md
                    leading-5
                    rounded-full
                    font-semibold
                    text-white
                `">
                    Create
                </button>
            </form>
        </div>

        <RouterView></RouterView>
    </div>
</template>
