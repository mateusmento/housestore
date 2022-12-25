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
    await channel.assertExchange("pricing", "topic");

    const products = [];
    const purchases = [];

    (async() => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "catalog", "product.registered");
        channel.consume(queue, (msg) => {
            let { id } = JSON.parse(msg.content.toString());
            products.push({ id, price: null, profitMargin: 0, taxes: 0 });
        }, { noAck: false, });
    })();

    (async() => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "purchasing", "product.purchased");
        channel.consume(queue, (msg) => {
            let purchase = JSON.parse(msg.content.toString());
            let product = findProductById(purchase.product.id);
            let newPurchase = {
                id: purchase.id,
                product,
                quantity: purchase.quantity,
                cost: purchase.cost,
            };
            purchases.push(newPurchase);
            product.price = calculatePrice(product, productPurchases);
        }, { noAck: true });
    })();

    app.get("/products", (req, res) => res.json(products));

    app.put("/products/:id/profit-margin", (req, res) => {
        const product = findProductById(+req.params.id);
        product.profitMargin = req.body.profitMargin;
        product.price = calculatePrice(product);
        res.json(product);
    });

    app.put("/products/:id/taxes", (req, res) => {
        const product = findProductById(+req.params.id);
        product.taxes = req.body.taxes;
        product.price = calculatePrice(product);
        res.json(product);
    });

    app.get("/purchases", (req, res) => res.json(purchases));

    function findProductById(id) {
        return products.find(p => p.id === id) || null;
    }

    function calculatePrice(product) {
        const productPurchases = purchases.filter(p => p.product.id === product.id);
        return averagePrice(productPurchases)
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
})();
