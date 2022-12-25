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
});
