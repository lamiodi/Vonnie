# Vonne X2X Backend

Backend API for the Vonne X2X Management System.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root directory (see `.env.example` if available) with:
    ```
    DATABASE_URL=postgresql://user:password@localhost:5432/vonne_x2x
    JWT_SECRET=your_jwt_secret
    PAYSTACK_SECRET_KEY=your_paystack_secret_key
    NODE_ENV=development
    PORT=5010
    ```

3.  **Run Migrations**:
    (Add migration instructions here, e.g., using a script or manual SQL execution)

## Running the Server

-   **Development**:
    ```bash
    npm run dev
    ```
-   **Production**:
    ```bash
    npm start
    ```

## Testing

The project uses [Jest](https://jestjs.io/) for testing.

### Running Tests

-   **Run all tests**:
    ```bash
    npm test
    ```

-   **Run specific tests**:
    ```bash
    npm test tests/bookingService.test.js
    ```

-   **Watch mode**:
    ```bash
    npm run test:watch
    ```

### Test Structure

-   `tests/`: Contains all unit and integration tests.
    -   `bookingService.test.js`: Tests for booking creation and validation.
    -   `paymentService.test.js`: Tests for payment verification logic.
    -   `webhook.test.js`: Tests for Paystack webhook processing.

## API Documentation

(Add link to API docs or basic route description)
