
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import PublicBooking from '../pages/PublicBooking';
import { AuthProvider } from '../contexts/AuthContext';
import { act } from 'react-dom/test-utils';

// Mock axios
jest.mock('axios');
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
  }
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('PublicBooking Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: [] });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <PublicBooking />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  test('renders booking form correctly', () => {
    renderComponent();
    
    expect(screen.getByText(/Book Your Appointment/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Jane Doe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/08012345678/i)).toBeInTheDocument();
    expect(screen.getByText(/Date & Time/i)).toBeInTheDocument();
  });

  test('validates required fields on submission', async () => {
    renderComponent();
    
    const submitButton = screen.getByText(/Confirm Booking/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Phone number is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Time is required/i)).toBeInTheDocument();
    });
  });

  test('fetches available slots when date is selected', async () => {
    const mockSlots = [
      { time: '09:00', label: '9:00 AM' },
      { time: '10:00', label: '10:00 AM' }
    ];
    axios.get.mockResolvedValueOnce({ data: mockSlots });

    renderComponent();

    // Trigger useEffect by initial render or date change
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/bookings/available-slots'),
        expect.any(Object)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('9:00 AM')).toBeInTheDocument();
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    });
  });

  test('handles slot selection correctly', async () => {
    const mockSlots = [{ time: '09:00', label: '9:00 AM' }];
    axios.get.mockResolvedValueOnce({ data: mockSlots });

    renderComponent();

    await waitFor(() => {
      const slotButton = screen.getByText('9:00 AM');
      fireEvent.click(slotButton);
      expect(slotButton).toHaveClass('bg-purple-600');
    });
  });

  test('submits valid booking form', async () => {
    const mockSlots = [{ time: '09:00', label: '9:00 AM' }];
    axios.get.mockResolvedValue({ data: mockSlots });
    axios.post.mockResolvedValue({ data: { data: { id: 1, booking_number: 'B123' } } });

    renderComponent();

    // Fill form
    await userEvent.type(screen.getByPlaceholderText(/Jane Doe/i), 'John Doe');
    await userEvent.type(screen.getByPlaceholderText(/08012345678/i), '08012345678');
    
    // Select time slot
    await waitFor(() => {
      const slotButton = screen.getByText('9:00 AM');
      fireEvent.click(slotButton);
    });

    // Submit
    const submitButton = screen.getByText(/Confirm Booking/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/bookings'),
        expect.objectContaining({
          customer_name: 'John Doe',
          customer_phone: '08012345678',
          scheduled_time: expect.stringContaining('T09:00:00')
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/booking-confirmation', expect.any(Object));
    });
  });

  test('handles API errors gracefully', async () => {
    axios.get.mockRejectedValue(new Error('Failed to fetch slots'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Could not load available times/i)).toBeInTheDocument();
    });
  });

  test('validates email format if provided', async () => {
    renderComponent();

    const emailInput = screen.getByPlaceholderText('jane@example.com');
    await userEvent.type(emailInput, 'invalid-email');
    
    const submitButton = screen.getByText(/Confirm Booking/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  test('validates phone number format', async () => {
    renderComponent();

    const phoneInput = screen.getByPlaceholderText('08012345678');
    await userEvent.type(phoneInput, '123'); // Invalid phone
    
    const submitButton = screen.getByText(/Confirm Booking/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid Nigerian phone number/i)).toBeInTheDocument();
    });
  });
});
