const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const amqp = require("amqplib");

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.listen(3001);

(async () => {
    const connection = await amqp.connect("amqp://localhost:5672");
    const channel = await connection.createChannel();
    const PURCHASING_EXCHANGE = "purchasing";
    await channel.assertExchange(PURCHASING_EXCHANGE, "topic");
    await channel.assertExchange("inventory", "topic");

    const products = [];
    const purchases = [];

    consumeFrom("catalog", "product.registered", ({ id }) => {
        products.push({ id });
    });

    consumeFrom("inventory", "product.inventory-is-low", ({ id }) => {
        const product = findProductById(id);
        if (!product) return;
        // TODO: Use vendors to determine the cost and use extra configuration for the quantity
        purchaseProduct(product, 2, 20);
    });

    app.get("/products", (req, res) => res.json(products));

    app.get("/products/:id/purchases", (req, res) => {
        return res.json(purchases.filter(p => p.product.id === +req.params.id));
    });

    app.post("/products/:id/purchases", (req, res) => {
        const productId = +req.params.id;
        const product = findProductById(productId);
        if (!product) {
            res.status(404);
            return res.json({
                status: 404,
                message: "Product not found"
            });
        }
        const purchase = purchaseProduct(product, req.body.quantity, req.body.cost);
        res.json(purchase);
    });

    function purchaseProduct(product, quantity, cost) {
        const newPurchase = {
            id: 1 + purchases.reduce((id, p) => Math.max(id, p.id), 0),
            product,
            quantity,
            cost
        };
        purchases.push(newPurchase);
        publishInPurchasing("product.purchased", newPurchase);
        return newPurchase;
    }

    function findProductById(id) {
        return products.find(p => p.id === id);
    }

    async function consumeFrom(exchange, route, consume) {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, exchange, route);
        channel.consume(queue, (msg) => {
            const content = JSON.parse(msg.content.toString());
            consume(content);
        }, { noAck: false });
    }

    function publishInPurchasing(route, content) {
        return channel.publish(PURCHASING_EXCHANGE, route, Buffer.from(JSON.stringify(content)));
    }
})();
