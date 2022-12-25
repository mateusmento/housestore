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
    const { exchange } = await channel.assertExchange("purchasing", "topic");

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
})();
