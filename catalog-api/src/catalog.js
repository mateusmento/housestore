const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");
const amqp = require("amqplib");

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.listen(3000);

(async () => {
    const connection = await amqp.connect("amqp://localhost:5672");
    const channel = await connection.createChannel();
    const CATALOG_EXCHANGE = "catalog";
    await channel.assertExchange(CATALOG_EXCHANGE, "topic");

    const products = [];
    
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

    app.post("/products", async (req, res) => {
        const newProduct = {
            id: 1 + products.reduce((id, p) => Math.max(id, p.id), 0),
            name: req.body.name
        };
        products.push(newProduct);
        channel.publish(CATALOG_EXCHANGE, "product.registered", Buffer.from(JSON.stringify(newProduct)), { persistent: true });
        res.json(newProduct);
    });
})();
