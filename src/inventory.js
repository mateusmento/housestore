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
        if (!product)
            return errorResponse(404, "Product not found");
        res.json(product);
    });

    app.put("/products/:id/decrease-quantity", (req, res) => {
        const product = decreaseInventory(+req.params.id, req.body.amount);
        if (!product)
            return errorResponse(404, "Product not found");
        res.json(product);
    });

    function increaseInventory(productId, amount) {
        const product = findProductById(productId);
        if (!product) return;
        product.quantity += amount;
        publishInInventory("product.inventory-adjusted", product);
        return product;
    }

    function decreaseInventory(productId, amount) {
        const product = findProductById(productId);
        if (!product) return;
        product.quantity -= amount;
        publishInInventory("product.inventory-adjusted", product);
        if (product.quantity === 0)
            publishInInventory("product.inventory-is-low", product);
        return product;
    }

    function findProductById(id) {
        return products.find(p => p.id === id);
    }

    function errorResponse(res, status, message) {
        res.status(status);
        return res.json({status, message});
    }

    function publishInInventory(route, content) {
        channel.publish(INVENTORY_EXCHANGE, route, Buffer.from(JSON.stringify(content)));
    }

})();

