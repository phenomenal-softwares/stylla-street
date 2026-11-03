const express = require("express");
const { rateLimit } = require("express-rate-limit");

const shopController = require('../controllers/shop');

const isAuth = require('../middleware/is-auth');

const router = express.Router();
const cartWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/", shopController.getIndex);

router.get("/products", shopController.getProducts);

router.get("/products/:productId", shopController.getProduct);

router.get("/cart", isAuth, shopController.getCart);

router.post("/cart", isAuth, cartWriteLimiter, shopController.postCart);

router.post(
	"/cart-delete-item",
	isAuth,
	cartWriteLimiter,
	shopController.postCartDeleteProduct,
);

router.get("/checkout", isAuth, shopController.getCheckout);

router.post("/checkout", isAuth, orderLimiter, shopController.postOrder);

router.get("/orders", isAuth, shopController.getOrders);

router.get('/orders/:orderId/invoice', isAuth, shopController.getInvoice);


module.exports = router;
