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

    const products = [];

    (async () => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "catalog", "product.registered");
        channel.consume(queue, (msg) => {
            const { id } = JSON.parse(msg.content.toString());
            products.push({ id });
        }, { noAck: false });
    })();

    app.get("/products", (req, res) => res.json(products));

    const purchases = [];

    app.get("/products/:id/purchases", (req, res) => {
        return res.json(purchases.filter(p => p.product.id === +req.params.id));
    });

    app.post("/products/:id/purchases", (req, res) => {
        const productId = +req.params.id;
        const product = products.find(p => p.id === productId);
        if (!product) {
            res.status(404);
            return res.json({
                status: 404,
                message: "Product not found"
            });
        }
        const newPurchase = {
            id: 1 + purchases.reduce((id, p) => Math.max(id, p.id), 0),
            product,
            quantity: req.body.quantity,
            cost: req.body.cost
        };
        purchases.push(newPurchase);
        channel.publish(PURCHASING_EXCHANGE, "product.purchased", Buffer.from(JSON.stringify(newPurchase)));
        res.json(newPurchase);
    });
})();
