(() => {
    let cart = [];
  
    // Load cart from localStorage
    try {
      cart = JSON.parse(localStorage.getItem('cart')) || [];
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
      cart = [];
    }
  
    // Utility: Save cart to localStorage
    function saveCart() {
      try {
        localStorage.setItem('cart', JSON.stringify(cart));
      } catch (error) {
        console.error('Failed to save cart to localStorage:', error);
      }
    }
  
    // Get cart
    function getCart() {
      return cart;
    }
  
    // Add item to cart with quantity
    function addToCart(productId, productName, productPrice, quantity = 1) {
      const existingItem = cart.find(item => item.productId === productId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.push({ productId, productName, productPrice: parseFloat(productPrice), quantity });
      }
      saveCart();
      updateCartUI();
      updateCartCount(); // Update cart count
    }
  
    // Remove item from cart
    function removeFromCart(productId) {
      const index = cart.findIndex(item => item.productId === productId);
      if (index !== -1) cart.splice(index, 1);
      saveCart();
      updateCartUI();
      updateCartCount(); // Update cart count
    }
  
    // Clear cart
    function clearCart() {
      cart = [];
      saveCart();
      updateCartUI();
      updateCartCount(); // Update cart count
    }
  
    // Update cart quantity
    function updateQuantity(productId, increment) {
      const item = cart.find(item => item.productId === productId);
      if (item) {
        item.quantity += increment;
        if (item.quantity < 1) removeFromCart(productId);
        saveCart();
        updateCartUI();
        updateCartCount(); // Update cart count
      }
    }
  
    // Calculate total price
    function calculateTotal() {
      return cart.reduce((sum, item) => sum + item.productPrice * item.quantity, 0).toFixed(2);
    }
  
    // Update cart count in the icon
    function updateCartCount() {
      const cartCount = document.getElementById('cart-count');
      if (cartCount) {
        cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
      }
    }
  
    // Render cart UI
    function updateCartUI() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartTotal = document.getElementById('cart-total');
        const clearCartButton = document.getElementById('clear-cart-button');
      
        if (!cartItemsContainer || !cartTotal || !clearCartButton) {
          console.error('Cart UI elements are missing.');
          return;
        }
      
        cartItemsContainer.innerHTML = cart.length
          ? cart.map(item => `
              <div class="cart-item">
                <span>${item.productName} - $${item.productPrice.toFixed(2)} (x${item.quantity})</span>
                <button onclick="removeFromCart('${item.productId}')">🗑️</button>
              </div>
            `).join('')
          : '<p>Your cart is empty</p>';
      
        cartTotal.textContent = `Total: $${calculateTotal()}`;
        clearCartButton.disabled = cart.length === 0;
      }
      
    // Checkout
    function checkout() {
      if (cart.length === 0) {
        alert('Your cart is empty. Add some products before checking out.');
        return;
      }
      try {
        // Save the cart data to localStorage before redirecting
        localStorage.setItem('cart', JSON.stringify(cart));
        window.location.href = '/checkout.html'; // Redirect to the checkout page
      } catch (error) {
        console.error('Failed to save cart before checkout:', error);
        alert('An error occurred. Please try again.');
      }
    }
  
    // Fetch products and render them with quantity options
    function fetchAndRenderProducts() {
      fetch('/products.json')
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch products');
          return response.json();
        })
        .then(products => {
          const productList = document.getElementById('product-list');
          if (!productList) {
            console.error('Product list element is missing.');
            return;
          }
          productList.innerHTML = products.map(product => `
            <div class="product">
              <img src="${product['Main Variant Image']}" alt="${product['Product Name']}">
              <h2>${product['Product Name']}</h2>
              <p>${product['Product Description']}</p>
              <p>Price: $${product['Variant Price']}</p>
              <div class="quantity-control">
                <button onclick="updateProductQuantity('${product['Product ID']}', -1)">-</button>
                <input type="number" id="quantity-${product['Product ID']}" value="1" min="1" class="quantity-input">
                <button onclick="updateProductQuantity('${product['Product ID']}', 1)">+</button>
              </div>
              <button onclick="addToCartWithQuantity('${product['Product ID']}', '${product['Product Name']}', ${parseFloat(product['Variant Price'].replace('$', ''))})">
                Add to Cart
              </button>
            </div>
          `).join('');
        })
        .catch(error => {
          console.error('Error fetching products:', error);
          const productList = document.getElementById('product-list');
          if (productList) {
            productList.innerHTML = '<p>Failed to load products. Please try again later.</p>';
          }
        });
    }
  
    // Update product quantity input
    function updateProductQuantity(productId, increment) {
      const quantityInput = document.getElementById(`quantity-${productId}`);
      if (quantityInput) {
        let newQuantity = parseInt(quantityInput.value) + increment;
        if (newQuantity < 1) newQuantity = 1;
        quantityInput.value = newQuantity;
      }
    }
  
    // Add to cart with specified quantity
    function addToCartWithQuantity(productId, productName, productPrice) {
      const quantityInput = document.getElementById(`quantity-${productId}`);
      const quantity = quantityInput ? parseInt(quantityInput.value) : 1;
      addToCart(productId, productName, productPrice, quantity);
    }
  
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      fetchAndRenderProducts();
      updateCartUI();
      updateCartCount(); // Initialize cart count
    });
  
    // Expose functions globally for button handlers
    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.updateQuantity = updateQuantity;
    window.checkout = checkout;
    window.updateProductQuantity = updateProductQuantity;
    window.addToCartWithQuantity = addToCartWithQuantity;
  })();