import express from 'express';
import bcrypt from 'bcryptjs';
import { authenticate } from '../middleware/auth.js';
import { checkManagerRole } from '../middleware/roleCheck.js';
import PaymentConfirmationValidator from '../utils/paymentConfirmationValidator.js';
import { pool } from '../config/database.js';
import { sendEmail, sendPaymentConfirmation } from '../services/email.js';
const router = express.Router();

/**
 * Manager Payment Confirmation Endpoint
 * Allows managers to confirm payments manually when Paystack is unavailable
 */
router.post('/confirm-payment/:bookingId', authenticate, checkManagerRole, async (req, res) => {
    const { bookingId } = req.params;
    const { managerPassword, paymentMethod, paymentReference, confirmationNotes, customerType } = req.body;
    const managerId = req.user.id;
    const managerUsername = req.user.username;
    const managerFullName = req.user.fullName;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    // Input validation
    if (!managerPassword || !paymentMethod || !customerType) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            details: {
                required: ['managerPassword', 'paymentMethod', 'customerType'],
                received: { managerPassword: !!managerPassword, paymentMethod: !!paymentMethod, customerType: !!customerType }
            }
        });
    }

    // Comprehensive validation
    const validation = await PaymentConfirmationValidator.validateCompletePaymentConfirmation(
        bookingId,
        managerId,
        managerPassword,
        paymentMethod,
        customerType,
        paymentReference,
        confirmationNotes
    );

    if (!validation.isValid) {
        return res.status(400).json({
            success: false,
            error: 'Payment confirmation validation failed',
            validationErrors: validation.errors,
            errorCode: 'VALIDATION_FAILED'
        });
    }

    const client = await pool.connect();
    
    try {
        // Start transaction
        await client.query('BEGIN');

        // Log the authorization attempt
        await client.query(
            `INSERT INTO manager_auth_attempts 
             (manager_id, username, action_type, resource_type, resource_id, success, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [managerId, managerUsername, 'payment_confirmation', 'booking', bookingId, true, ipAddress, userAgent]
        );

        // Step 2: Get current booking details
        const bookingQuery = `
            SELECT b.*, 
                   COALESCE(pt.payment_status, 'pending') as pos_payment_status
            FROM bookings b
            LEFT JOIN pos_transactions pt ON b.id = pt.booking_id
            WHERE b.id = $1
        `;
        const bookingResult = await client.query(bookingQuery, [bookingId]);
        
        if (bookingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        const booking = bookingResult.rows[0];
        const previousPaymentStatus = booking.payment_status;
        
        // Check if payment is already confirmed
        if (booking.payment_status === 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Payment has already been confirmed for this booking',
                currentStatus: booking.payment_status
            });
        }

        // Step 3: Determine new payment status based on customer type and payment method
        let newPaymentStatus;
        if (paymentMethod === 'physical_pos') {
            newPaymentStatus = 'pending';
        } else {
            newPaymentStatus = 'completed';
        }

        // Step 4: Update inventory for service products first (fail fast if inventory unavailable)
        let inventoryResult;
        try {
            inventoryResult = await updateInventoryForConfirmedPayment(client, bookingId, managerId, newPaymentStatus);
        } catch (inventoryError) {
            await client.query('ROLLBACK');
            
            // Handle insufficient stock errors specifically
            if (inventoryError.message.includes('insufficient_stock')) {
                const insufficientData = JSON.parse(inventoryError.message.replace('insufficient_stock: ', ''));
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient inventory to confirm payment',
                    errorCode: 'INSUFFICIENT_INVENTORY',
                    insufficientProducts: insufficientData
                });
            }
            
            return res.status(400).json({
                success: false,
                error: inventoryError.message,
                errorCode: 'INVENTORY_UPDATE_FAILED'
            });
        }

        // Step 5: Update booking with payment confirmation
        const updateBookingQuery = `
            UPDATE bookings 
            SET 
                payment_status = $1,
                payment_method = $2,
                payment_reference = COALESCE($3, payment_reference),
                payment_confirmed_by = $4,
                payment_confirmed_at = CURRENT_TIMESTAMP,
                payment_confirmation_method = 'manual_verification',
                payment_confirmation_notes = $5,
                customer_type = $6,
                payment_date = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `;
        
        const updatedBooking = await client.query(updateBookingQuery, [
            newPaymentStatus, paymentMethod, paymentReference, managerId, 
            confirmationNotes, customerType, bookingId
        ]);

        // Step 6: Update POS transaction if exists
        if (booking.pos_transaction_id) {
            const updatePosQuery = `
                UPDATE pos_transactions 
                SET payment_status = $1, payment_method = $2, payment_reference = $3
                WHERE id = $4
            `;
            await client.query(updatePosQuery, [newPaymentStatus, paymentMethod, paymentReference, booking.pos_transaction_id]);
        }

        // Step 7: Log payment confirmation action
        const logQuery = `
            INSERT INTO payment_confirmation_logs 
            (booking_id, manager_id, previous_payment_status, new_payment_status, 
             confirmation_method, payment_reference, confirmation_notes, 
             manager_username, manager_full_name, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        
        await client.query(logQuery, [
            bookingId, managerId, previousPaymentStatus, newPaymentStatus,
            'manual_verification', paymentReference, confirmationNotes,
            managerUsername, managerFullName, ipAddress, userAgent
        ]);

        // Step 8: Send confirmation notifications (async - don't fail the transaction if notifications fail)
        try {
            await sendPaymentConfirmationNotifications(client, bookingId, newPaymentStatus, managerFullName);
        } catch (notificationError) {
            console.error('Notification sending failed:', notificationError);
            // Don't rollback the transaction for notification failures
        }

        // Commit transaction
        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Payment confirmed successfully',
            data: {
                booking: updatedBooking.rows[0],
                previousStatus: previousPaymentStatus,
                newStatus: newPaymentStatus,
                confirmedBy: managerFullName,
                confirmedAt: new Date().toISOString(),
                inventoryUpdate: inventoryResult || { success: false, message: 'No inventory updates needed' },
                lowStockWarnings: inventoryResult?.lowStockWarnings || []
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Payment confirmation error:', error);
        
        // Log the error for monitoring
        try {
            await pool.query(
                `INSERT INTO error_logs (error_type, error_message, error_stack, context, severity, source_module)
                 VALUES ('PAYMENT_CONFIRMATION_ERROR', $1, $2, $3, 'ERROR', 'payment-confirmation')`,
                [error.message, error.stack, JSON.stringify({ bookingId, managerId, paymentMethod, customerType })]
            );
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        // Determine appropriate error response
        let statusCode = 500;
        let errorMessage = 'Internal server error during payment confirmation';
        let errorCode = 'INTERNAL_ERROR';
        
        if (error.code === '23505') { // Unique constraint violation
            statusCode = 409;
            errorMessage = 'Payment confirmation already exists for this booking';
            errorCode = 'DUPLICATE_CONFIRMATION';
        } else if (error.code === '23503') { // Foreign key constraint violation
            statusCode = 400;
            errorMessage = 'Invalid reference to related records';
            errorCode = 'INVALID_REFERENCE';
        } else if (error.message.includes('insufficient_stock')) {
            statusCode = 400;
            errorMessage = 'Insufficient inventory to confirm payment';
            errorCode = 'INSUFFICIENT_INVENTORY';
        }
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            errorCode: errorCode,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        client.release();
    }
});

/**
 * Helper function to update inventory for confirmed payments
 */
async function updateInventoryForConfirmedPayment(client, bookingId, managerId, paymentStatus) {
    // Skip inventory update for pending status
    if (paymentStatus === 'pending') {
        return { 
            success: true, 
            message: 'Inventory update skipped for pending payment',
            lowStockWarnings: []
        };
    }
    try {
        // Get all products/services associated with this booking
        const bookingItemsQuery = `
            SELECT 
                bi.product_id,
                bi.quantity,
                bi.service_id,
                p.name as product_name,
                p.stock_quantity as current_stock,
                p.min_stock_level,
                s.name as service_name
            FROM booking_items bi
            LEFT JOIN products p ON bi.product_id = p.id
            LEFT JOIN services s ON bi.service_id = s.id
            WHERE bi.booking_id = $1
        `;
        
        const itemsResult = await client.query(bookingItemsQuery, [bookingId]);
        const insufficientStock = [];
        const lowStockWarnings = [];
        
        // First pass: validate all inventory requirements
        for (const item of itemsResult.rows) {
            if (item.product_id && item.current_stock !== null) {
                if (item.current_stock < item.quantity) {
                    insufficientStock.push({
                        productId: item.product_id,
                        productName: item.product_name,
                        currentStock: item.current_stock,
                        requiredQuantity: item.quantity
                    });
                }
            }
        }

        if (insufficientStock.length > 0) {
            throw new Error(`insufficient_stock: ${JSON.stringify(insufficientStock)}`);
        }

        // Second pass: update inventory
        for (const item of itemsResult.rows) {
            if (item.product_id && item.current_stock !== null) {
                // Update product stock
                const newStock = item.current_stock - item.quantity;

                // Update product stock
                await client.query(
                    'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [newStock, item.product_id]
                );

                // Log inventory adjustment
                await client.query(
                    `INSERT INTO payment_inventory_logs 
                     (booking_id, product_id, adjustment_quantity, previous_stock_level, 
                      new_stock_level, adjustment_reason, adjusted_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        bookingId, item.product_id, -item.quantity, 
                        item.current_stock, newStock, 
                        `Payment confirmation (${paymentStatus}) - automatic stock adjustment`,
                        managerId
                    ]
                );

                // Create stock movement record
                await client.query(
                    `INSERT INTO stock_movements 
                     (product_id, quantity, movement_type, reference_id, notes, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        item.product_id, -item.quantity, 'sale',
                        bookingId, 
                        `Payment confirmation - ${item.product_name} (${item.quantity} units)`,
                        managerId
                    ]
                );

                // Check for low stock warning
                if (newStock <= item.min_stock_level) {
                    lowStockWarnings.push({
                        productId: item.product_id,
                        productName: item.product_name,
                        currentStock: newStock,
                        minStockLevel: item.min_stock_level
                    });
                }
            }
        }

        // Send low stock alerts if any products are below minimum stock
        if (lowStockWarnings.length > 0) {
            try {
                await sendLowStockAlerts(client, lowStockWarnings);
            } catch (alertError) {
                console.error('Low stock alert sending failed:', alertError);
                // Don't fail the transaction for alert failures
            }
        }

        return { 
            success: true, 
            lowStockWarnings,
            message: `Inventory updated successfully for ${itemsResult.rows.length} products`
        };

    } catch (error) {
        console.error('Inventory update error:', error);
        
        if (error.message.includes('insufficient_stock')) {
            const insufficientData = JSON.parse(error.message.replace('insufficient_stock: ', ''));
            throw new Error('Insufficient inventory to confirm payment');
        }
        
        throw error; // Re-throw to trigger transaction rollback
    }
}

/**
 * Helper function to send payment confirmation notifications
 */
async function sendPaymentConfirmationNotifications(client, bookingId, paymentStatus, managerName) {
    try {
        // Get booking details with customer info
        const bookingQuery = `
            SELECT b.*, c.email as customer_email, c.full_name as customer_name,
                   c.phone as customer_phone, s.name as service_name
            FROM bookings b
            JOIN customers c ON b.customer_id = c.id
            JOIN services s ON b.service_id = s.id
            WHERE b.id = $1
        `;
        
        const bookingResult = await client.query(bookingQuery, [bookingId]);
        
        if (bookingResult.rows.length > 0) {
            const booking = bookingResult.rows[0];
            const formattedStatus = paymentStatus.replace('_', ' ');
            const formattedDate = new Date(booking.booking_date).toLocaleDateString();
            const formattedTime = booking.booking_time;
            
            // Log notification in database
            const notificationQuery = `
                INSERT INTO notifications (user_id, type, title, message, status, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `;
            
            // Notify customer
            await client.query(notificationQuery, [
                booking.customer_id, 'payment_confirmation',
                `Payment Confirmed - Booking #${booking.booking_number}`,
                `Your payment has been confirmed by ${managerName}. Status: ${formattedStatus}`,
                'sent'
            ]);
            
            // Notify admin/management
            await client.query(notificationQuery, [
                null, 'payment_confirmation_admin',
                `Payment Confirmed by Manager`,
                `Manager ${managerName} confirmed payment for booking #${booking.booking_number}. Status: ${formattedStatus}`,
                'sent'
            ]);
            
            // Send email notification to customer using unified payment confirmation
            if (booking.customer_email) {
                try {
                    await sendPaymentConfirmation(
                        booking.customer_email,
                        {
                            bookingNumber: booking.booking_number,
                            customerName: booking.customer_name,
                            amount: booking.service_price,
                            paymentMethod: paymentMethod || 'manager confirmation',
                            source: 'booking'
                        }
                    );
                    console.log('✅ Email notification sent to customer:', booking.customer_email);
                } catch (emailError) {
                    console.error('❌ Email notification failed:', emailError.message);
                }
            }
            
            // WhatsApp notifications removed - using email only
        }
        
    } catch (error) {
        console.error('Notification error:', error);
        // Don't throw - notifications shouldn't block the main transaction
    }
}

/**
 * Get payment confirmation history for a booking
 */
router.get('/confirmation-history/:bookingId', authenticate, async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const historyQuery = `
            SELECT 
                pcl.*,
                u.full_name as manager_name,
                u.email as manager_email
            FROM payment_confirmation_logs pcl
            JOIN users u ON pcl.manager_id = u.id
            WHERE pcl.booking_id = $1
            ORDER BY pcl.created_at DESC
        `;
        
        const result = await pool.query(historyQuery, [bookingId]);
        
        res.json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('Get confirmation history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve confirmation history'
        });
    }
});

/**
 * Get payment confirmation statistics
 */
router.get('/confirmation-stats', authenticate, checkManagerRole, async (req, res) => {
    try {
        const { startDate, endDate, managerId } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (startDate) {
            whereClause += ` AND pcl.created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause += ` AND pcl.created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (managerId) {
            whereClause += ` AND pcl.manager_id = $${paramIndex}`;
            params.push(managerId);
            paramIndex++;
        }
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_confirmations,
                COUNT(CASE WHEN pcl.new_payment_status = 'PREPAID_CONFIRMED' THEN 1 END) as prepaid_confirmations,
                COUNT(CASE WHEN pcl.new_payment_status = 'WALKIN_PAID' THEN 1 END) as walkin_confirmations,
                COUNT(DISTINCT pcl.manager_id) as unique_managers,
                AVG(CASE WHEN pcl.previous_payment_status = 'pending' THEN 1 ELSE 0 END) as pending_conversion_rate,
                u.full_name as top_manager_name
            FROM payment_confirmation_logs pcl
            JOIN users u ON pcl.manager_id = u.id
            ${whereClause}
            GROUP BY u.full_name
            ORDER BY total_confirmations DESC
            LIMIT 1
        `;
        
        const result = await pool.query(statsQuery, params);
        
        res.json({
            success: true,
            data: result.rows[0] || {
                total_confirmations: 0,
                prepaid_confirmations: 0,
                walkin_confirmations: 0,
                unique_managers: 0,
                pending_conversion_rate: 0
            }
        });
        
    } catch (error) {
        console.error('Get confirmation stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve confirmation statistics'
        });
    }
});

/**
 * Helper function to send low stock alerts to management
 */
async function sendLowStockAlerts(client, lowStockWarnings) {
    try {
        // Get admin and manager emails for alerts
        const adminQuery = `
            SELECT email, full_name, role 
            FROM users 
            WHERE role IN ('admin', 'manager') 
            AND status = 'active'
            ORDER BY role, full_name
        `;
        
        const adminResult = await client.query(adminQuery);
        
        if (adminResult.rows.length > 0) {
            // Create alert message
            const alertMessage = lowStockWarnings.map(item => 
                `• ${item.productName}: ${item.currentStock} units remaining (min: ${item.minStockLevel})`
            ).join('\n');
            
            // Send email alerts to management
            for (const admin of adminResult.rows) {
                try {
                    await sendEmail({
                        to: admin.email,
                        subject: '⚠️ Low Stock Alert - Inventory Update',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #ff9800;">⚠️ Low Stock Alert</h2>
                                <p>Dear ${admin.full_name},</p>
                                <p>The following products have fallen below their minimum stock levels during a recent payment confirmation:</p>
                                
                                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <h3>Low Stock Items:</h3>
                                    <pre style="font-family: monospace; margin: 10px 0;">${alertMessage}</pre>
                                </div>
                                
                                <p>Please review and reorder these items to maintain adequate stock levels.</p>
                                <p>Best regards,<br>Vonne X2X Inventory System</p>
                            </div>
                        `
                    });
                    console.log(`✅ Low stock alert sent to ${admin.role}:`, admin.email);
                } catch (emailError) {
                    console.error(`❌ Low stock alert failed for ${admin.email}:`, emailError.message);
                }
            }
            
            // Log the alert in database
            const alertLogQuery = `
                INSERT INTO notifications (user_id, type, title, message, status, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `;
            
            await client.query(alertLogQuery, [
                null, 'low_stock_alert',
                `Low Stock Alert - ${lowStockWarnings.length} Items`,
                `Low stock detected: ${alertMessage}`,
                'sent'
            ]);
        }
        
    } catch (error) {
        console.error('Low stock alert error:', error);
        // Don't throw - alerts shouldn't block the main transaction
    }
}

export default router;