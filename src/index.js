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
})();
