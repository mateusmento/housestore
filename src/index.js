const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.listen(3002);

(async() => {
    const connection = await amqp.connect("amqp://localhost:5672");
    const channel = await connection.createChannel();
    await channel.assertExchange("inventory", "topic");

    const products = [];

    (async() => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "catalog", "product.registered");
        channel.consume(queue, (msg) => {
            const { id } = JSON.parse(msg.content.toString());
            products.push({ id, quantity: 0 });
        }, { noAck: false });
    })();

    (async() => {
        const { queue } = channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "purchasing", "product.purchased");
        channel.consume(queue, (msg) => {
            const purchase = JSON.parse(msg.content.toString());
            increaseInventory(purchase.product.id, purchase.quantity);
        }, { noAck: false });
    })();

    app.get("/products", (req, res) => res.json(products));

    function increaseInventory(productId, amount) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        product.quantity += amount;
        return product;
    }
})();