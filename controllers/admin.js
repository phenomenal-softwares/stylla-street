const { validationResult } = require("express-validator");
const crypto = require("crypto");

const supabase = require("../util/supabase");
const BUCKET = process.env.SUPABASE_PRODUCT_BUCKET;
const Product = require("../models/product");
const User = require("../models/user");
const PRODUCT_LIMIT = User.PRODUCT_LIMIT;

exports.getAddProduct = async (req, res, next) => {
  try {
    const productCount = await Product.countDocuments({ userId: req.user._id });
    res.render("admin/edit-product", {
      pageTitle: "Add a watch",
      path: "/admin/add-product",
      editing: false,
      hasError: false,
      errorMessage: null,
      validationErrors: [],
      product: { title: "", imageUrl: "", price: "", description: "" },
      productCount,
      productLimit: PRODUCT_LIMIT,
    });
  } catch (err) {
    next(err);
  }
};

exports.postAddProduct = async (req, res, next) => {
  const { title, description, price } = req.body;
  const image = req.file;
  const createdBy = req.user.email.split("@")[0];

  if (!image) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add a watch",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      errorMessage: "Please select a valid image under 3 MB.",
      validationErrors: [],
      product: { title, price, description },
      productCount: await Product.countDocuments({ userId: req.user._id }),
      productLimit: PRODUCT_LIMIT,
    });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add a watch",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      product: { title, price, description },
      productCount: await Product.countDocuments({ userId: req.user._id }),
      productLimit: PRODUCT_LIMIT,
    });
  }

  const extension = image.mimetype === "image/png" ? "png" : "jpg";
  const imagePath = `products/${req.user._id}/${crypto.randomUUID()}.${extension}`;
  let slotReserved = false;
  let imageUploaded = false;

  try {
    slotReserved = await req.user.reserveProductSlot();

    if (!slotReserved) {
      const productCount = await Product.countDocuments({ userId: req.user._id });
      return res.status(422).render("admin/edit-product", {
        pageTitle: "Add a watch",
        path: "/admin/add-product",
        editing: false,
        hasError: true,
        errorMessage: `Your account is limited to ${PRODUCT_LIMIT} watch listings. Delete one of your listings to add another.`,
        validationErrors: [],
        product: { title, price, description },
        productCount,
        productLimit: PRODUCT_LIMIT,
      });
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(imagePath, image.buffer, {
        contentType: image.mimetype,
        upsert: false,
      });

    if (uploadError) throw uploadError;
    imageUploaded = true;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);

    const product = new Product({
      title,
      imageUrl: data.publicUrl,
      imagePath,
      price,
      description,
      createdBy,
      userId: req.user,
    });

    await product.save();
    slotReserved = false;

    console.log("Product added!");
    res.redirect("/admin/products");
  } catch (err) {
    if (imageUploaded) {
      try {
        const { error: cleanupError } = await supabase.storage
          .from(BUCKET)
          .remove([imagePath]);
        if (cleanupError) console.error("Could not clean up the uploaded product image.", cleanupError);
      } catch (cleanupError) {
        console.error("Could not clean up the uploaded product image.", cleanupError);
      }
    }
    if (slotReserved) {
      try {
        await req.user.releaseProductSlot();
      } catch (releaseError) {
        console.error("Could not release the reserved product slot.", releaseError);
      }
    }
    const error = new Error(err.message || "Could not upload product image.");
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect("/");
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: editMode,
        product: product,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = async (req, res, next) => {
  const { productId: prodId, title: updatedTitle, price: updatedPrice, description: updatedDesc } = req.body;
  const image = req.file;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Edit Product",
      path: "/admin/edit-product",
      editing: true,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId,
      },
    });
  }

  try {
    const product = await Product.findById(prodId);

    if (!product || product.userId.toString() !== req.user._id.toString()) {
      return res.redirect("/");
    }

    product.title = updatedTitle;
    product.price = updatedPrice;
    product.description = updatedDesc;

    if (image) {
      const extension = image.mimetype === "image/png" ? "png" : "jpg";
      const newImagePath = `products/${req.user._id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(newImagePath, image.buffer, {
          contentType: image.mimetype,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(newImagePath);

      const oldImagePath = product.imagePath;

      product.imagePath = newImagePath;
      product.imageUrl = data.publicUrl;

      await product.save();

      if (oldImagePath) {
        await supabase.storage.from(BUCKET).remove([oldImagePath]);
      }
    } else {
      await product.save();
    }

    console.log("Product edited!");
    res.redirect("/admin/products");
  } catch (err) {
    const error = new Error(err.message || "Could not update product.");
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    .then((products) => {
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.deleteProduct = async (req, res) => {
  const prodId = req.params.productId;

  try {
    const product = await Product.findById(prodId);

    if (!product) {
      return res.sendStatus(204);
    }

    if (product.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized." });
    }

    // imagePath is the Supabase object key saved at upload time:
    // products/<userId>/<uuid>.jpg
    if (product.imagePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([product.imagePath]);

      if (storageError) {
        throw storageError;
      }
    }

    const deletion = await Product.deleteOne({ _id: prodId });
    if (deletion.deletedCount > 0) {
      await req.user.releaseProductSlot();
    }

    console.log("Product and Supabase image deleted!");
    return res.status(200).json({ message: "Success!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Deleting product failed.",
    });
  }
};