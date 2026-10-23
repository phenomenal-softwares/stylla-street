const fs = require("fs");
const path = require("path");

const PDFDocument = require("pdfkit");

const Product = require("../models/product");
const Order = require("../models/order");

const ITEMS_PER_PAGE = 3;

exports.getProducts = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .sort({ _id: -1 })
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/product-list",
        currentPage: page,
        totalProducts: totalItems,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/product-list",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  Product.find()
    .sort({ _id: -1 })
    .limit(3)
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        heroProduct: products[0] || null,
        pageTitle: "Home",
        path: "/",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .then((user) => {
      const products = user.cart.items.filter((item) => item.productId);
      if (products.length !== user.cart.items.length) {
        user.cart.items = products;
        user.cart.totalPrice = products
          .reduce((sum, item) => sum + item.price, 0)
          .toFixed(2);
        return user.save();
      }
      return user;
    })
    .then((user) => {
      const products = user.cart.items.filter((item) => item.productId);
      const totalPrice = user.cart.totalPrice;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
        totalPrice: totalPrice,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        const error = new Error("Product not found");
        error.httpStatusCode = 404;
        throw error;
      }
      return req.user.addToCart(product);
    })
    .then(() => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(() => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = async (req, res, next) => {
  try {
    const user = await req.user.populate("cart.items.productId");
    const products = user.cart.items.filter((item) => item.productId);

    if (products.length === 0) {
      return res.redirect("/cart");
    }

    return res.render("shop/checkout", {
      path: "/checkout",
      pageTitle: "Demo checkout",
      products,
      totalPrice: user.cart.totalPrice,
    });
  } catch (err) {
    next(err);
  }
};

exports.postOrder = async (req, res, next) => {
  try {
    const user = await req.user.populate("cart.items.productId");
    const products = user.cart.items
      .filter((item) => item.productId)
      .map((item) => ({
        quantity: item.quantity,
        product: { ...item.productId._doc },
        price: item.price,
      }));

    if (products.length === 0) {
      return res.redirect("/cart");
    }

    const order = new Order({
      user: {
        email: req.user.email,
        userId: req.user,
      },
      products,
      createdAt: new Date(),
      totalPrice: products.reduce((sum, product) => sum + product.price, 0),
    });

    await order.save();
    console.log("Demo order placed!");
    await req.user.clearCart();
    console.log("Cart cleared!");
    return res.redirect("/orders");
  } catch (err) {
    next(err);
  }
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .sort({ createdAt: -1 })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
        totalPrice: orders.reduce((sum, order) => sum + order.totalPrice, 0),
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  const invoiceName = "invoice-" + orderId + ".pdf";
  const invoicePath = path.join(
    __dirname,
    "..",
    "data",
    "invoices",
    invoiceName,
  );

  Order.findOne({ _id: orderId, "user.userId": req.user._id })
    .then((order) => {
      if (!order) {
        const error = new Error("Order not found.");
        error.httpStatusCode = 404;
        throw error;
      }

      if (order.user.userId.toString() !== req.user._id.toString()) {
        const error = new Error("Unauthorized");
        error.httpStatusCode = 403;
        throw error;
      }

      const pdfDoc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoiceName + '"',
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath)); // Write the PDF to a file
      pdfDoc.pipe(res); // Pipe the PDF to the response

      const colors = {
        ink: "#182324",
        muted: "#697473",
        gold: "#99723b",
        line: "#e7e6df",
        surface: "#f6f5f0",
      };
      const formatCurrency = (amount) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      const left = 48;
      const right = pdfDoc.page.width - 48;
      const contentWidth = right - left;
      const footerY = pdfDoc.page.height - 96;
      let pageNumber = 1;

      const drawFooter = () => {
        pdfDoc
          .moveTo(left, footerY - 10)
          .lineTo(right, footerY - 10)
          .strokeColor(colors.line)
          .stroke();
        pdfDoc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(colors.muted);
        pdfDoc.text(
          "PHENOMENAL SOFTWARES NIG. LTD | www.phenomenalproductions.com.ng",
          left,
          footerY,
          {
            width: contentWidth - 64,
            lineBreak: false,
          },
        );
        pdfDoc.text(`Page ${pageNumber}`, left, footerY, {
            width: contentWidth,
            align: "right",
            lineBreak: false,
          });
      };

      const drawTableHeader = (y) => {
        pdfDoc.rect(left, y, contentWidth, 26).fillColor(colors.surface).fill();
        pdfDoc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(colors.muted)
          .text("ITEM", left + 8, y + 8, { lineBreak: false })
          .text("QTY", 348, y + 8, {
            width: 38,
            align: "right",
            lineBreak: false,
          })
          .text("UNIT PRICE", 394, y + 8, {
            width: 76,
            align: "right",
            lineBreak: false,
          })
          .text("AMOUNT", 478, y + 8, {
            width: 78,
            align: "right",
            lineBreak: false,
          });
        pdfDoc.y = y + 34;
      };

      const startContinuationPage = () => {
        drawFooter();
        pdfDoc.addPage();
        pageNumber += 1;
        pdfDoc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(colors.ink)
          .text("STYLLA STREET", left, 42, { lineBreak: false })
          .font("Helvetica")
          .fontSize(9)
          .fillColor(colors.muted)
          .text("INVOICE - CONTINUED", left, 60, { lineBreak: false });
        drawTableHeader(88);
      };

      pdfDoc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(colors.ink)
        .text("STYLLA STREET", left, 48, { lineBreak: false });
      pdfDoc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(colors.muted)
        .text("Thoughtful watches, thoughtfully collected", left, 69, {
          lineBreak: false,
        });
      pdfDoc
        .font("Helvetica-Bold")
        .fontSize(25)
        .fillColor(colors.gold)
        .text("INVOICE", left, 48, {
          width: contentWidth,
          align: "right",
          lineBreak: false,
        });
      pdfDoc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(colors.gold)
        .text("SAMPLE - NO PAYMENT COLLECTED", left, 81, {
          width: contentWidth,
          align: "right",
          lineBreak: false,
        });
      pdfDoc
        .moveTo(left, 105)
        .lineTo(right, 105)
        .strokeColor(colors.gold)
        .lineWidth(1.5)
        .stroke();

      const invoiceDate = new Date(order.createdAt);
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
      }).format(invoiceDate);
      pdfDoc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(colors.muted)
        .text("BILLED TO", left, 124, { lineBreak: false })
        .text("ORDER DETAILS", 330, 124, { lineBreak: false });
      pdfDoc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(colors.ink)
        .text(`Invoice date: ${formattedDate}`, 330, 140, {
          width: right - 330,
        })
        .text(`Order ID: ${order._id}`, 330, 156, {
          width: right - 330,
        });

      const billToHeight = pdfDoc.heightOfString(order.user.email, {
        width: 250,
      });
      pdfDoc.text(order.user.email, left, 140, { width: 250 });
      drawTableHeader(Math.max(190, 140 + billToHeight + 18));
      order.products.forEach((item) => {
        const title = item.product.title;
        pdfDoc.font("Helvetica").fontSize(10);
        const rowHeight = Math.max(
          28,
          pdfDoc.heightOfString(title, { width: 282 }) + 12,
        );
        if (pdfDoc.y + rowHeight > footerY - 24) {
          startContinuationPage();
        }

        const rowY = pdfDoc.y;
        const lineTotal = Number(item.price);
        const quantity = Number(item.quantity);
        pdfDoc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(colors.ink)
          .text(title, left + 8, rowY + 5, { width: 282 })
          .text(String(quantity), 348, rowY + 5, {
            width: 38,
            align: "right",
            lineBreak: false,
          })
          .text(
            formatCurrency(quantity ? lineTotal / quantity : lineTotal),
            394,
            rowY + 5,
            { width: 76, align: "right", lineBreak: false },
          )
          .text(formatCurrency(lineTotal), 478, rowY + 5, {
            width: 78,
            align: "right",
            lineBreak: false,
          });
        pdfDoc
          .moveTo(left, rowY + rowHeight)
          .lineTo(right, rowY + rowHeight)
          .strokeColor(colors.line)
          .lineWidth(0.6)
          .stroke();
        pdfDoc.y = rowY + rowHeight;
      });

      if (pdfDoc.y + 112 > footerY - 24) {
        startContinuationPage();
      }
      const subtotal = order.products.reduce(
        (sum, item) => sum + Number(item.price),
        0,
      );
      const summaryY = pdfDoc.y + 16;
      pdfDoc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(colors.muted)
        .text("Subtotal", 370, summaryY, { width: 100 })
        .text(formatCurrency(subtotal), 478, summaryY, {
          width: 78,
          align: "right",
        });
      pdfDoc
        .moveTo(370, summaryY + 22)
        .lineTo(right, summaryY + 22)
        .strokeColor(colors.line)
        .stroke();
      pdfDoc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(colors.ink)
        .text("TOTAL", 370, summaryY + 32, { width: 100 })
        .text(formatCurrency(Number(order.totalPrice)), 478, summaryY + 32, {
          width: 78,
          align: "right",
        });
      pdfDoc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(colors.muted)
        .text(
          "This is a sample order record for demonstration purposes only. No payment was processed.",
          left,
          summaryY + 74,
          { width: contentWidth, align: "left" },
        );

      drawFooter();
      pdfDoc.end();
    })
    .catch((err) => {
      console.log(err);
      next(err);
    });
};
