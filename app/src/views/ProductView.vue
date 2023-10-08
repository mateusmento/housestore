<script lang="ts" setup>
import axios from 'axios';
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { CATALOG_BASE_URL, INVENTORY_BASE_URL, PURCHASING_BASE_URL, PRICING_BASE_URL } from './product-api';

const viewingProduct = ref<any>({});
const props = defineProps<{ id: string }>();

function onInit(cb: () => void) {
    onMounted(cb);
    watch(() => props.id, cb);
}

function onDestroy(cb: () => void) {
    onUnmounted(cb);
}

let sse: EventSource;

onInit(async () => {
    const { data } = await axios.get(CATALOG_BASE_URL + "/products/" + props.id);
    viewingProduct.value = {...viewingProduct.value, ...data};
    sse && sse.close();
    sse = new EventSource(`${INVENTORY_BASE_URL}/products/${data.id}/inventory/streaming`);
    sse.onmessage = ({ data }) => {
        viewingProduct.value.quantity = JSON.parse(data).quantity;
    };
});

onDestroy(() => sse && sse.close());

onInit(async () => {
    const { data } = await axios.get(INVENTORY_BASE_URL + "/products/" + props.id);
    viewingProduct.value = {...viewingProduct.value, ...data};
});

onInit(async () => {
    const { data } = await axios.get(PURCHASING_BASE_URL + "/products/" + props.id + "/purchases");
    viewingProduct.value.purchases = data;
});

let priceStreaming: EventSource;

onInit(async () => {
    const { data } = await axios.get(PRICING_BASE_URL + "/products/" + props.id);
    viewingProduct.value.price = data.price;
    priceStreaming && priceStreaming.close();
    priceStreaming = new EventSource(`${PRICING_BASE_URL}/products/${props.id}/price/streaming`);
    priceStreaming.onmessage = ({ data }) => {
        viewingProduct.value.price = JSON.parse(data).price;
    };
});

onDestroy(() => priceStreaming && priceStreaming.close());

const purchaseQuantity = ref(0);
const purchaseCost = ref(0);

async function purchaseProduct() {
    const url = PURCHASING_BASE_URL + "/products/" + props.id + "/purchases";
    const { data } = await axios.post(url, { quantity: +purchaseQuantity.value, cost: +purchaseCost.value});
    viewingProduct.value.purchases.push(data);
}
</script>

<template>
    <div v-if="viewingProduct">
        <div>Id: {{ props.id }}</div>
        <b>{{viewingProduct.name}}</b>
        <div>Availability: {{viewingProduct.quantity}}x</div>
        <div>Price: ${{viewingProduct.price}}</div>
        <div>Purchases:</div>
        <ul>
            <li v-for="purchase of viewingProduct.purchases" :key="purchase.id">
                <div>{{ purchase.id }}. {{ purchase.quantity }}x (${{ purchase.cost }} each)</div>
            </li>
        </ul>
        <form class="flex flex-col gap-2" @submit.prevent="purchaseProduct">
            <label for="">Quantity</label>
            <input class="px-4 py-1 rounded-full text-black" v-model="purchaseQuantity"/>
            <label for="">Cost</label>
            <input class="px-4 py-1 rounded-full text-black" v-model="purchaseCost"/>
            <button type="submit" :class="`
                block
                bg-violet-500
                hover:bg-violet-600
                focus:outline-none focus:ring
                focus:ring-violet-300
                active:bg-violet-700
                px-4 py-1 ml-auto
                text-md
                leading-5
                rounded-full
                font-semibold
                text-white
            `">
                Purchase
            </button>
        </form>
    </div>
</template>
