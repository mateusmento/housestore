const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.listen(3003);

(async() => {
    const connection = await amqp.connect();
    const channel = await connection.createChannel();
    await channel.assertExchange("pricing", "topic");

    const products = [];

    (async() => {
        const { queue } = await channel.assertQueue("", { exclusive: true });
        await channel.bindQueue(queue, "catalog", "product.registered");
        channel.consume(queue, (msg) => {
            let { id } = JSON.parse(msg.content.toString());
            products.push({ id, price: null, profitMargin: 0, taxes: 0 });
        }, { noAck: false, });
    })();
});
