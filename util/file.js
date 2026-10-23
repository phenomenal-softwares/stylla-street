const fs = require("fs");
const path = require("path");

const deleteFile = (filePath) => {
  const imagePath = filePath.startsWith("/images/")
    ? path.join(__dirname, "..", filePath)
    : filePath;

  fs.unlink(imagePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Error deleting file:", err);
    }
  });
};

module.exports = { deleteFile };