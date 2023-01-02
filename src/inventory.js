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
    await channel.assertExchange("purchasing", "topic");
    const products = [];

    consumeFrom("catalog", "product.registered", ({ id }) => {
        products.push({ id, quantity: 0 });
    });

    consumeFrom("purchasing", "product.purchased", (purchase) => {
        increaseInventory(purchase.product.id, purchase.quantity);
    });

    consumeFrom("sales", "product.sold", (sale) => {
        decreaseInventory(sale.product.id, sale.quantity);
    });

    app.get("/products", (req, res) => res.json(products));

    app.get("/products/:id", (req, res) => {
        const product = products.find(p => p.id === +req.params.id);
        if (!product) {
            res.status(404);
            return res.json({
                status: 404,
                message: "Product not found"
            });
        }
        res.json(product);
    });

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

    async function consumeFrom(exchange, route, consume) {
        const { queue } = await channel.assertQueue("", { exclusive: true, durable: true });
        await channel.bindQueue(queue, exchange, route);
        channel.consume(queue, (msg) => {
            const content = JSON.parse(msg.content.toString());
            consume(content);
        }, { noAck: false });
    }
})();

