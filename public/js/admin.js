/* global document, alert */
document.addEventListener("click", async (event) => {
  const button = event.target.closest(".js-delete-product");

  if (!button || button.disabled) return;

  const productId = button.dataset.productId;
  button.disabled = true;

  try {
    const response = await fetch(`/admin/product/${productId}`, {
      method: "DELETE",
      headers: {
        "csrf-token": button.dataset.csrfToken,
      },
    });

    if (!response.ok) {
      throw new Error("Could not delete product.");
    }

    button.closest("article")?.remove();
  } catch (error) {
    console.error(error);
    alert("Deleting the product failed. Please try again.");
    button.disabled = false;
  }
});
