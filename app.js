const express = require('express');
const axios = require('axios');
const { body, validationResult } = require('express-validator'); // For validation
const winston = require('winston'); // For logging
const rateLimit = require('express-rate-limit'); // For rate limiting
const cors = require('cors'); // For CORS
const app = express();

// Load environment variables
require('dotenv').config();

// Configure Winston logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

// Middleware to log requests
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Enable CORS
app.use(cors());

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Middleware to validate payment data
const validatePaymentData = [
    body('cart').isArray().withMessage('Cart must be an array'),
    body('card-number').isCreditCard().withMessage('Invalid card number'),
    body('expiry').matches(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/).withMessage('Invalid expiry date'),
    body('cvv').isLength({ min: 3, max: 4 }).withMessage('Invalid CVV'),
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Invalid email'),
    body('address').notEmpty().withMessage('Address is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('state').notEmpty().withMessage('State is required'),
    body('zip').isPostalCode('US').withMessage('Invalid ZIP code'),
];

// Shippo Address Validation
app.post('/validate-address', async (req, res) => {
    try {
        const address = req.body;
        const response = await axios.post('https://api.goshippo.com/addresses/', {
            ...address,
            validate: true
        }, {
            headers: {
                'Authorization': `ShippoToken ${process.env.SHIPPO_API_KEY}`
            }
        });
        res.json(response.data);
    } catch (error) {
        logger.error('Error validating address:', error);
        res.status(500).json({ success: false, message: 'Failed to validate address' });
    }
});

// Authorize.net Payment Processing
app.post('/process-payment', validatePaymentData, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Validation errors:', errors.array());
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { cart, 'card-number': cardNumber, expiry, cvv, name, email, address, city, state, zip } = req.body;

        // Calculate total amount from cart
        const totalAmount = cart.reduce((sum, item) => sum + parseFloat(item.price), 0).toFixed(2);

        // Process payment with Authorize.Net
        const merchantAuthenticationType = new AuthorizeNet.MerchantAuthenticationType();
        merchantAuthenticationType.setName(process.env.AUTHORIZE_NET_API_LOGIN_ID);
        merchantAuthenticationType.setTransactionKey(process.env.AUTHORIZE_NET_TRANSACTION_KEY);

        const creditCard = new AuthorizeNet.CreditCardType();
        creditCard.setCardNumber(cardNumber.replace(/\s+/g, ''));
        creditCard.setExpirationDate(expiry);
        creditCard.setCardCode(cvv);

        const paymentType = new AuthorizeNet.PaymentType();
        paymentType.setCreditCard(creditCard);

        const transactionRequestType = new AuthorizeNet.TransactionRequestType();
        transactionRequestType.setTransactionType(AuthorizeNet.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
        transactionRequestType.setPayment(paymentType);
        transactionRequestType.setAmount(totalAmount);

        const createRequest = new AuthorizeNet.CreateTransactionRequest();
        createRequest.setMerchantAuthentication(merchantAuthenticationType);
        createRequest.setTransactionRequest(transactionRequestType);

        const ctrl = new AuthorizeNetControllers.CreateTransactionController(createRequest.getJSON());
        ctrl.execute(() => {
            const apiResponse = ctrl.getResponse();
            if (apiResponse.messages.resultCode === 'Ok') {
                res.json({ success: true, transactionId: apiResponse.transactionResponse.transId });
            } else {
                logger.error('Payment processing failed:', apiResponse.messages.message[0].text);
                res.json({ success: false, message: apiResponse.messages.message[0].text });
            }
        });
    } catch (error) {
        logger.error('Error processing payment:', error);
        res.status(500).json({ success: false, message: 'Failed to process payment' });
    }
});

// Mock function to simulate payment processing with Authorize.Net
function processPaymentWithAuthorizeNet(paymentDetails) {
    // Simulate a successful response from Authorize.Net
    return {
        messages: {
            resultCode: 'Ok',
            message: [
                {
                    code: 'I00001',
                    text: 'Successful.'
                }
            ]
        },
        transactionResponse: {
            responseCode: '1',
            authCode: 'ABC123',
            transId: '1234567890',
            accountNumber: 'XXXX1234',
            accountType: 'Visa',
            amount: paymentDetails.amount
        }
    };
}

// Endpoint to process payment (mock)
app.post('/mock-process-payment', (req, res) => {
    const paymentDetails = req.body; // Payment details from the frontend

    // Simulate payment processing
    const paymentResponse = processPaymentWithAuthorizeNet(paymentDetails);

    // Return the payment response to the frontend
    res.status(200).json(paymentResponse);
});

// Endpoint to save the payment response to the database
app.post('/save-order', (req, res) => {
    const orderData = req.body; // Payment response from the frontend

    // Save the order to the database (pseudo-code)
    saveOrderToDatabase(orderData);

    res.status(200).json({ message: 'Order saved successfully' });
});

function saveOrderToDatabase(orderData) {
    // Save the order to your database (e.g., MongoDB, MySQL)
    console.log('Order saved:', orderData);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));