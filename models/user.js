const mongoose = require("mongoose");

const Schema = mongoose.Schema;
const PRODUCT_LIMIT = 2;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  resetToken: String,
  resetTokenExpiration: Date,
  productCount: {
    type: Number,
    min: 0,
    max: PRODUCT_LIMIT,
    validate: Number.isInteger,
  },
  cart: {
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
      }
    ],
    totalPrice: {
      type: Number,
      required: true,
      default: 0,
    },
  },
});

userSchema.statics.PRODUCT_LIMIT = PRODUCT_LIMIT;

userSchema.methods.reserveProductSlot = async function () {
  const User = this.constructor;
  const Product = require("./product");
  const existingProducts = await Product.countDocuments({ userId: this._id });

  if (existingProducts >= PRODUCT_LIMIT) {
    return false;
  }

  let user = await User.findById(this._id).select("productCount");

  if (!user) {
    throw new Error("Could not find the user to reserve a product slot.");
  }

  if (user.productCount == null) {
    user = await User.findOneAndUpdate(
      { _id: this._id, productCount: { $exists: false } },
      { $set: { productCount: existingProducts } },
      { new: true },
    );

    if (!user) {
      return this.reserveProductSlot();
    }
  }

  const reservedUser = await User.findOneAndUpdate(
    { _id: this._id, productCount: { $lt: PRODUCT_LIMIT } },
    { $inc: { productCount: 1 } },
    { new: true },
  );

  return Boolean(reservedUser);
};

userSchema.methods.releaseProductSlot = function () {
  return this.constructor.updateOne(
    { _id: this._id, productCount: { $gt: 0 } },
    { $inc: { productCount: -1 } },
  );
};

userSchema.methods.addToCart = function (product) {
  const cartProductIndex = this.cart.items.findIndex((cp) => {
    return cp.productId.toString() === product._id.toString();
  });
  let newQuantity = 1;
  let price = product.price;
  const updatedCartItems = [...this.cart.items];

  if (cartProductIndex >= 0) {
    newQuantity = this.cart.items[cartProductIndex].quantity + 1;
    price = product.price * newQuantity;
    updatedCartItems[cartProductIndex].quantity = newQuantity;
    updatedCartItems[cartProductIndex].price = price;
  } else {
    updatedCartItems.push({
      productId: product._id,
      quantity: newQuantity,
      price: product.price * newQuantity,
    });
  }

  const updatedCart = {
    items: updatedCartItems,
    totalPrice: updatedCartItems.reduce((sum, item) => sum + item.price, 0).toFixed(2),
  };

  this.cart = updatedCart;
  return this.save();
};

userSchema.methods.removeFromCart = function (productId) {
  const updatedCartItems = this.cart.items.filter((item) => {
    return item.productId.toString() !== productId.toString();
  });

  this.cart.items = updatedCartItems;
  this.cart.totalPrice = updatedCartItems.reduce((sum, item) => sum + item.price, 0).toFixed(2);
  return this.save();
};

userSchema.methods.clearCart = function () {
  this.cart = { items: [], totalPrice: 0 };
  return this.save();
}

module.exports = mongoose.model("User", userSchema);
