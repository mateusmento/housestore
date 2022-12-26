const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.listen(3003);

(async() => {
    const connection = await amqp.connect("amqp://localhost:5672");
    const channel = await connection.createChannel();
    const PRICING_EXCHANGE = "pricing";
    await channel.assertExchange(PRICING_EXCHANGE, "topic");

    const products = [];
    const purchases = [];

    consumeFrom("catalog", "product.registered", ({ id }) => {
        products.push({ id, price: null, profitMargin: 0, taxes: 0 });
    });

    consumeFrom("purchasing", "product.purchased", (purchase) => {
        let product = findProductById(purchase.product.id);
        let newPurchase = {
            id: purchase.id,
            product,
            quantity: purchase.quantity,
            cost: purchase.cost,
        };
        purchases.push(newPurchase);
        calculatePrice(product);
    });

    app.get("/products", (req, res) => res.json(products));

    app.put("/products/:id/profit-margin", (req, res) => {
        const product = findProductById(+req.params.id);
        product.profitMargin = req.body.profitMargin;
        calculatePrice(product);
        res.json(product);
    });

    app.put("/products/:id/taxes", (req, res) => {
        const product = findProductById(+req.params.id);
        product.taxes = req.body.taxes;
        calculatePrice(product);
        res.json(product);
    });

    app.get("/purchases", (req, res) => res.json(purchases));

    function findProductById(id) {
        return products.find(p => p.id === id) || null;
    }

    function calculatePrice(product) {
        const productPurchases = purchases.filter(p => p.product.id === product.id);
        product.price = averagePrice(product, productPurchases);
        publishInPricing("product.price-calculated", product);
    }

    function averagePrice(product, purchases) {
        const { profitMargin, taxes } = product;
        const totalCost = purchases
            .map(p => (p.cost + profitMargin + taxes) * p.quantity)
            .reduce((a, b) => a + b);
        const totalQuantity = purchases
            .map(p => p.quantity)
            .reduce((a, b) => a + b);
        return totalCost / totalQuantity;
    }

    async function consumeFrom(exchange, route, consume) {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, exchange, route);
        channel.consume(queue, (msg) => {
            const content = JSON.parse(msg.content.toString());
            consume(content);
        }, { noAck: false });
    }

    function publishInPricing(route, content) {
        return channel.publish(PRICING_EXCHANGE, route, Buffer.from(JSON.stringify(content)));
    }
})();
