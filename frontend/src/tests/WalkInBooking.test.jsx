
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';
import WalkInBooking from '../pages/WalkInBooking';
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

describe('WalkInBooking Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: [] });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <WalkInBooking />
        </AuthProvider>
      </BrowserRouter>
    );
  };

  test('renders walk-in booking form correctly', () => {
    renderComponent();
    
    expect(screen.getByText(/Walk-In/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name */i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone */i)).toBeInTheDocument();
    expect(screen.getByText(/Select Time */i)).toBeInTheDocument();
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
      { time: '12:00', label: '12:00 PM' },
      { time: '13:00', label: '1:00 PM' }
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
      expect(screen.getByText('12:00 PM')).toBeInTheDocument();
      expect(screen.getByText('1:00 PM')).toBeInTheDocument();
    });
  });

  test('handles slot selection correctly', async () => {
    const mockSlots = [{ time: '12:00', label: '12:00 PM' }];
    axios.get.mockResolvedValueOnce({ data: mockSlots });

    renderComponent();

    await waitFor(() => {
      const slotButton = screen.getByText('12:00 PM');
      fireEvent.click(slotButton);
      expect(slotButton).toHaveClass('bg-black');
    });
  });

  test('submits valid booking form', async () => {
    const mockSlots = [{ time: '12:00', label: '12:00 PM' }];
    axios.get.mockResolvedValue({ data: mockSlots });
    axios.post.mockResolvedValue({ data: { data: { id: 2, booking_number: 'W456' } } });

    renderComponent();

    // Fill form
    await userEvent.type(screen.getByLabelText(/Name */i), 'Walk In User');
    await userEvent.type(screen.getByLabelText(/Phone */i), '08098765432');
    
    // Select time slot
    await waitFor(() => {
      const slotButton = screen.getByText('12:00 PM');
      fireEvent.click(slotButton);
    });

    // Submit
    const submitButton = screen.getByText(/Confirm Booking/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/public/bookings'),
        expect.objectContaining({
          customer_name: 'Walk In User',
          customer_phone: '08098765432',
          scheduled_time: expect.stringContaining('T12:00:00'),
          customer_type: 'walk_in'
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

  test('toggles optional fields visibility', async () => {
    renderComponent();

    const toggleButton = screen.getByText(/Add Email or Instagram/i);
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Instagram/i)).toBeInTheDocument();
    });
  });

  test('validates phone number format', async () => {
    renderComponent();

    const phoneInput = screen.getByLabelText(/Phone */i);
    await userEvent.type(phoneInput, 'invalid-phone');
    
    const submitButton = screen.getByText(/Confirm Booking/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid Nigerian phone number/i)).toBeInTheDocument();
    });
  });
});
