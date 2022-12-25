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
            let newPurchase = {
                id: purchase.id,
                product: findProductById(purchase.product.id),
                cost: purchase.cost,
            };
            purchases.push(newPurchase);
        }, { noAck: true });
    })();

    app.get("/products", (req, res) => res.json(products));
    app.get("/purchases", (req, res) => res.json(purchases));

    function findProductById(id) {
        return products.find(p => p.id === id) || null;
    }
})();
