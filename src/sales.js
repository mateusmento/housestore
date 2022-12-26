const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.listen(3004);

(async () => {
    const connection = await amqp.connect("amqp://localhost:5672");
    const channel = await connection.createChannel();
    const SALES_EXCHANGE = "sales";
    await channel.assertExchange(SALES_EXCHANGE, "topic");

    const products = [];
    const sales = [];

    (async () => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "catalog", "product.registered");
        channel.consume(queue, (msg) => {
            let { id } = JSON.parse(msg.content.toString());
            products.push({ id });
        }, { noAck: false });
    })();

    (async () => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "inventory", "product.inventory-adjusted");
        channel.consume(queue, (msg) => {
            let { id, quantity } = JSON.parse(msg.content.toString());
            let product = products.find(p => p.id === id);
            if (!product) return;
            product.quantity = quantity;
        }, { noAck: false });
    })();

    (async () => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "pricing", "product.price-calculated");
        channel.consume(queue, (msg) => {
            let { id, price } = JSON.parse(msg.content.toString());
            let product = products.find(p => p.id === id);
            if (!product) return;
            product.price = price;
        }, { noAck: false });
    })();

    app.get("/products", (req, res) => res.json(products));

    app.get("/sales", (req, res) => res.json(sales));

    app.post("/sales", (req, res) => {
        const product = products.find(p => p.id === req.body.productId);
        if (product.quantity < req.body.quantity) {
            res.status(400);
            return res.json({
                status: 400,
                message: "Unavailable product quantity for sale"
            });
        }
        const newSale = {
            id: 1 + sales.reduce((id, s) => id + s.id, 0),
            product: products.find(p => p.id === req.body.productId),
            quantity: req.body.quantity
        };
        sales.push(newSale);
        channel.publish(SALES_EXCHANGE, "product.sold", Buffer.from(JSON.stringify(newSale)));
        res.json(newSale);
    });

    async function consumeFrom(exchange, route, consume) {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, exchange, route);
        channel.consume(queue, (msg) => {
            const content = JSON.parse(msg.content.toString());
            consume(content);
        }, { noAck: false });
    }

    function publishInSales(route, content) {
        return channel.publish(SALES_EXCHANGE, route, Buffer.from(JSON.stringify(content)));
    }
})();
