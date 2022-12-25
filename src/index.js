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
    const INVENTORY_EXCHANGE = "inventory";
    await channel.assertExchange(INVENTORY_EXCHANGE, "topic");
    await channel.assertExchange("sales", "topic");

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
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "purchasing", "product.purchased");
        channel.consume(queue, (msg) => {
            const purchase = JSON.parse(msg.content.toString());
            increaseInventory(purchase.product.id, purchase.quantity);
        }, { noAck: false });
    })();

    (async() => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "sales", "product.sold");
        channel.consume(queue, (msg) => {
            const sale = JSON.parse(msg.content.toString());
            decreaseInventory(sale.product.id, sale.quantity);
        }, { noAck: false });
    })();

    app.get("/products", (req, res) => res.json(products));

    app.put("/products/:id/increase-quantity", (req, res) => {
        const product = increaseInventory(+req.params.id, req.body.amount);
        if (!product) {
            res.status(404);
            return res.json({
                status: 404,
                message: "Product not found"
            });
        }
        res.json(product);
    });

    app.put("/products/:id/decrease-quantity", (req, res) => {
        const product = decreaseInventory(+req.params.id, req.body.amount);
        if (!product) {
            res.status(404);
            return res.json({
                status: 404,
                message: "Product not found"
            });
        }
        res.json(product);
    });

    function increaseInventory(productId, amount) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        product.quantity += amount;
        channel.publish(INVENTORY_EXCHANGE, "product.inventory-adjusted", Buffer.from(JSON.stringify(product)));
        return product;
    }

    function decreaseInventory(productId, amount) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        product.quantity -= amount;
        channel.publish(INVENTORY_EXCHANGE, "product.inventory-adjusted", Buffer.from(JSON.stringify(product)));
        return product;
    }
})();