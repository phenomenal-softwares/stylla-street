# Stylla Street

Stylla Street is a wristwatch marketplace demonstration built by Phenomenal Softwares Nig. Ltd. Visitors can browse community listings, while registered users can manage listings, maintain a cart, and create sample order records.

> **Demo only:** Checkout does not collect payment. Orders and invoices are simulated records; no real purchases or payments take place.

## Features

### Public marketplace

- Browse the watch collection and view individual product details.
- Explore the latest listings on the home page.
- Browse the product catalogue with pagination; the newest products appear first.
- View listing descriptions, prices, product images, and creator names.

### Accounts and security

- Register with an email address and password, then log in and log out.
- Passwords are hashed with bcrypt before being stored.
- Request a password-reset link by email and set a replacement password using the time-limited token.
- Authenticated routes protect account-specific features.
- CSRF protection is enabled for form requests, and Helmet configures HTTP security headers.
- Sessions are stored in MongoDB.

### Watch listings

- Authenticated users can create, edit, and delete their own listings.
- Each account can have up to two listings.
- Listing images accept PNG and JPEG files up to 3 MB.
- Product image files are stored in Supabase Storage; listing data is stored in MongoDB.
- Users can update a listing's image when editing it.

### Cart and demo orders

- Add watches to a personal cart, adjust quantities by adding items again, and remove items.
- Review the cart and its calculated total before checkout.
- Place a **demo order** from the checkout page. No payment provider is used and no money is charged.
- View personal order history, with the newest orders first.
- Download or open a professionally formatted sample invoice PDF for an order. Invoices are restricted to the order's owner and clearly state that no payment was collected.

### Interface

- Server-rendered pages with responsive navigation and a mobile menu.
- Dedicated pages for the home page, catalogue, product details, authentication, listing management, cart, checkout, and order history.
- Custom 404 and 500 error pages.

## Technology stack

- **Runtime:** Node.js
- **Web framework:** Express 5
- **Templates:** EJS
- **Database and object modeling:** MongoDB with Mongoose
- **Session storage:** `connect-mongodb-session`
- **Product image storage:** Supabase Storage using `@supabase/supabase-js`
- **Authentication support:** `express-session`, `bcryptjs`, and `express-validator`
- **Password reset email:** Nodemailer with Gmail SMTP
- **Invoice PDFs:** PDFKit
- **Uploads and middleware:** Multer, Helmet, compression, Morgan, CSRF protection, and connect-flash
- **Frontend:** HTML, CSS, browser JavaScript, Google Fonts, and Font Awesome
- **Development tooling:** Nodemon and ESLint

## Requirements

- Node.js and npm
- A MongoDB deployment accessible by the application
- A Supabase project with a Storage bucket for product images
- Gmail SMTP credentials if password-reset email is required

## Setup

1. Obtain authorization to access and use this project. See [LICENSE](./LICENSE).
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env.local` file in the project root. Keep real credentials private and out of source control:

   ```dotenv
   MONGO_USER=your_mongodb_username
   MONGO_PASSWORD=your_mongodb_password
   MONGO_DB=your_database_name

   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your_supabase_secret_key
   SUPABASE_PRODUCT_BUCKET=your_product_image_bucket

   EMAIL_USER=your_gmail_address
   EMAIL_PASS=your_gmail_app_password

   PORT=3000
   ```

   The MongoDB connection uses the application's configured MongoDB Atlas host. Configure database credentials and network access for that deployment. The Supabase bucket must exist and be configured to serve product images at the public URLs used by listings.

4. Start the development server:

   ```sh
   npm run start:dev
   ```

   Or start the application without Nodemon:

   ```sh
   npm start
   ```

5. Open `http://localhost:3000` unless a different `PORT` is configured.

The package also defines `npm run start:dev:https`, but the current application startup does not consume `HTTPS` or configure an HTTPS server. That script should not be treated as enabling TLS; use a properly configured HTTPS reverse proxy or implement and verify TLS handling before exposing the application beyond local development.

## Project structure

```text
.
├── controllers/       Request handlers for shop, account, and listing workflows
├── data/invoices/     Generated invoice PDF files
├── middleware/        Authentication middleware
├── models/            Mongoose models for users, products, and orders
├── public/            Static CSS, JavaScript, and logo assets
├── routes/            Express route definitions
├── util/              Shared utilities and Supabase client setup
├── views/             EJS page templates and shared includes
├── app.js             Express application and database startup
└── package.json       Dependencies and npm scripts
```

## Development notes

- `npm test` is currently a placeholder and exits with an error; no automated test suite is configured.
- Product and order history are stored in MongoDB. Invoice PDFs are written to `data/invoices/` when generated.
- This application is a demonstration, not a production payment or commerce system. Do not enter real payment information.
- The project license does not grant permission to access or use the source. Prior written authorization is required; see [LICENSE](./LICENSE).

## Authorship

- **Author:** Abiodun Ojo
- **Company:** Phenomenal Softwares Nig. Ltd.
- **Date:** October 23, 2026
